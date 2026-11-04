import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

// === ЗАЯВКИ ===

export async function getAllRequests(filters?: { status?: string; master_id?: number }) {
  let query = `
    SELECT r.request_id, r.created_at, r.problem_description, r.total_cost,
           s.name AS status_name,
           c.full_name AS client_name,
           d.type AS device_type, d.brand AS device_brand, d.model AS device_model,
           m.full_name AS master_name, r.master_id,
           (SELECT SUM(amount) FROM payment WHERE request_id = r.request_id AND status = 'completed') AS paid_amount
    FROM request r
    JOIN status s ON s.status_id = r.status_id
    JOIN client c ON c.client_id = r.client_id
    JOIN device d ON d.device_id = r.device_id
    LEFT JOIN master m ON m.master_id = r.master_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIdx = 1;

  if (filters?.status) {
    query += ` AND s.name = $${paramIdx++}`;
    params.push(filters.status);
  }
  if (filters?.master_id) {
    query += ` AND r.master_id = $${paramIdx++}`;
    params.push(filters.master_id);
  }

  query += ` ORDER BY r.created_at DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}
export async function assignMaster(requestId: number, masterId: number) {
  const res = await pool.query(
    `UPDATE request SET master_id = $1, status_id = (SELECT status_id FROM status WHERE name = 'Принята')
     WHERE request_id = $2 RETURNING request_id`,
    [masterId, requestId]
  );
  if (res.rows.length === 0) throw new AppError('Заявка не найдена', 404);
  return res.rows[0];
}

// === МАСТЕРА ===

export async function getAllMasters() {
  const res = await pool.query(
    `SELECT master_id, full_name, phone, specialization, rating, login FROM master ORDER BY full_name`
  );
  return res.rows;
}

// === СКЛАД (ЗАПЧАСТИ) ===

export async function getAllParts() {
  const res = await pool.query(`
    SELECT p.*, s.name AS supplier_name 
    FROM part p
    LEFT JOIN supplier s ON s.supplier_id = p.supplier_id
    ORDER BY p.name
  `);
  return res.rows;
}

export async function createPart(data: {
  name: string; article?: string; quantity: number; price: number; min_quantity: number; supplier_id?: number;
}) {
  const res = await pool.query(
    `INSERT INTO part (name, article, quantity, price, min_quantity, supplier_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.name, data.article || null, data.quantity, data.price, data.min_quantity, data.supplier_id || null]
  );
  return res.rows[0];
}

// Увеличить остаток (поставка)
export async function supplyPart(partId: number, quantity: number) {
  const res = await pool.query(
    `UPDATE part SET quantity = quantity + $1 WHERE part_id = $2 RETURNING *`,
    [quantity, partId]
  );
  return res.rows[0];
}

export async function getAllSuppliers() {
  const res = await pool.query('SELECT * FROM supplier ORDER BY name');
  return res.rows;
}

// === ЗАКАЗЫ ПОСТАВЩИКАМ ===

export async function createPurchaseOrder(supplierId: number, items: { part_id: number; quantity: number }[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `INSERT INTO purchase_order (supplier_id, status) VALUES ($1, 'ordered') RETURNING order_id`,
      [supplierId]
    );
    const orderId = orderRes.rows[0].order_id;

    for (const item of items) {
      await client.query(
        `INSERT INTO order_item (order_id, part_id, quantity) VALUES ($1, $2, $3)`,
        [orderId, item.part_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    return { order_id: orderId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function receivePurchaseOrder(orderId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Проверяем, что заказ существует и ещё не получен
    const orderRes = await client.query(
      `SELECT status FROM purchase_order WHERE order_id = $1`,
      [orderId]
    );
    if (orderRes.rows.length === 0) throw new AppError('Заказ не найден', 404);
    if (orderRes.rows[0].status === 'received') throw new AppError('Заказ уже получен', 400);

    // Получаем все позиции заказа
    const itemsRes = await client.query(
      `SELECT part_id, quantity FROM order_item WHERE order_id = $1`,
      [orderId]
    );

    // Увеличиваем остатки на складе
    for (const item of itemsRes.rows) {
      await client.query(
        `UPDATE part SET quantity = quantity + $1 WHERE part_id = $2`,
        [item.quantity, item.part_id]
      );
    }

    // Меняем статус заказа
    await client.query(
      `UPDATE purchase_order SET status = 'received', received_at = NOW() WHERE order_id = $1`,
      [orderId]
    );

    await client.query('COMMIT');
    return { status: 'ok' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createService(data: { name: string; price: number; duration: number }) {
  const res = await pool.query(
    `INSERT INTO service (name, price, duration) VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.price, data.duration]
  );
  return res.rows[0];
}

export async function updateService(id: number, data: { name: string; price: number; duration: number }) {
  const res = await pool.query(
    `UPDATE service SET name = $1, price = $2, duration = $3 WHERE service_id = $4 RETURNING *`,
    [data.name, data.price, data.duration, id]
  );
  return res.rows[0];
}

export async function deleteService(id: number) {
  await pool.query('DELETE FROM service WHERE service_id = $1', [id]);
  return { status: 'ok' };
}

export async function getAllDiagnostics() {
  const query = `
    SELECT 
      d.diagnostic_id, 
      d.diagnostic_date, 
      d.result, 
      d.recommended_actions, 
      d.estimated_cost,
      r.request_id,
      r.problem_description,
      c.full_name AS client_name,
      m.full_name AS master_name
    FROM diagnostic d
    JOIN request r ON r.request_id = d.request_id
    JOIN client c ON c.client_id = r.client_id
    LEFT JOIN master m ON m.master_id = r.master_id
    ORDER BY d.diagnostic_date DESC
  `;
  const result = await pool.query(query);
  return result.rows;
}

export async function updateRequestStatus(requestId: number, statusName: string) {
  const statusRes = await pool.query('SELECT status_id FROM status WHERE name = $1', [statusName]);
  if (statusRes.rows.length === 0) throw new AppError('Статус не найден', 400);
  
  const res = await pool.query(
    'UPDATE request SET status_id = $1 WHERE request_id = $2 RETURNING request_id',
    [statusRes.rows[0].status_id, requestId]
  );
  return res.rows[0];
}

// === ПЕРСОНАЛ ===

export async function getStaffStats() {
  const query = `
    SELECT 
      m.master_id,
      m.full_name,
      m.phone,
      m.specialization,
      m.rating,
      m.login,
      COUNT(r.request_id) AS total_requests,
      COUNT(CASE WHEN s.name IN ('Готово', 'Оплачено', 'Выдано') THEN 1 END) AS completed_requests
    FROM master m
    LEFT JOIN request r ON r.master_id = m.master_id
    LEFT JOIN status s ON s.status_id = r.status_id
    GROUP BY m.master_id, m.full_name, m.phone, m.specialization, m.rating, m.login
    ORDER BY completed_requests DESC
  `;
  const result = await pool.query(query);
  return result.rows;
}

export async function updateMaster(masterId: number, data: {
  full_name?: string;
  phone?: string;
  specialization?: string;
}) {
  const res = await pool.query(
    `UPDATE master 
     SET full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         specialization = COALESCE($3, specialization)
     WHERE master_id = $4 RETURNING master_id`,
    [data.full_name, data.phone, data.specialization, masterId]
  );
  if (res.rows.length === 0) throw new AppError('Мастер не найден', 404);
  return res.rows[0];
}