import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

export async function createRequest(clientId: number, data: {
  problem_description: string;
  device: {
    type: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    condition?: string;
  };
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Создаём устройство
    const deviceRes = await client.query(
      `INSERT INTO device (client_id, type, brand, model, serial_number, condition)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING device_id`,
      [
        clientId,
        data.device.type,
        data.device.brand || null,
        data.device.model || null,
        data.device.serial_number || null,
        data.device.condition || null,
      ]
    );
    const deviceId = deviceRes.rows[0].device_id;

    // 2. Ищем статус "Новая" (по умолчанию для новых заявок)
    const statusRes = await client.query(
      `SELECT status_id FROM status WHERE name = 'Новая' LIMIT 1`
    );
    if (statusRes.rows.length === 0) {
      throw new Error('Статус "Новая" не найден в справочнике');
    }
    const statusId = statusRes.rows[0].status_id;

    // 3. Создаём заявку
    const requestRes = await client.query(
      `INSERT INTO request (client_id, device_id, status_id, problem_description)
       VALUES ($1, $2, $3, $4) RETURNING request_id, created_at`,
      [clientId, deviceId, statusId, data.problem_description]
    );

    await client.query('COMMIT');
    return requestRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getClientRequests(clientId: number, statusName?: string) {
  let query = `
    SELECT r.request_id, r.created_at, r.completed_at, r.problem_description,
           r.total_cost, s.name AS status_name,
           d.type AS device_type, d.brand AS device_brand, d.model AS device_model
    FROM request r
    JOIN status s ON s.status_id = r.status_id
    JOIN device d ON d.device_id = r.device_id
    WHERE r.client_id = $1
  `;
  const params: any[] = [clientId];

  if (statusName) {
    query += ` AND s.name = $2`;
    params.push(statusName);
  }

  query += ` ORDER BY r.created_at DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getRequestDetails(requestId: number, clientId: number) {
  const reqRes = await pool.query(
    `SELECT r.*, s.name AS status_name,
            d.type AS device_type, d.brand AS device_brand, d.model AS device_model, d.serial_number,
            m.full_name AS master_name
     FROM request r
     JOIN status s ON s.status_id = r.status_id
     JOIN device d ON d.device_id = r.device_id
     LEFT JOIN master m ON m.master_id = r.master_id
     WHERE r.request_id = $1 AND r.client_id = $2`,
    [requestId, clientId]
  );

  if (reqRes.rows.length === 0) {
    throw new AppError('Заявка не найдена', 404);
  }

  const request = reqRes.rows[0];

  // Получаем диагностику, отчёт и оплату (если есть)
  const diagRes = await pool.query('SELECT * FROM diagnostic WHERE request_id = $1', [requestId]);
  const reportRes = await pool.query('SELECT * FROM work_report WHERE request_id = $1', [requestId]);
  const payRes = await pool.query('SELECT * FROM payment WHERE request_id = $1', [requestId]);

  return {
    ...request,
    diagnostic: diagRes.rows[0] || null,
    work_report: reportRes.rows[0] || null,
    payment: payRes.rows[0] || null,
  };
}

export async function cancelRequest(requestId: number, clientId: number) {
  const statusRes = await pool.query(`SELECT status_id FROM status WHERE name = 'Отменена' LIMIT 1`);
  const cancelStatusId = statusRes.rows[0].status_id;

  // Можно отменить только если заявка ещё не в работе и не завершена
  const check = await pool.query(
    `SELECT s.name FROM request r JOIN status s ON s.status_id = r.status_id
     WHERE r.request_id = $1 AND r.client_id = $2`,
    [requestId, clientId]
  );

  if (check.rows.length === 0) throw new AppError('Заявка не найдена', 404);
  const currentStatus = check.rows[0].name;

  if (['В работе', 'Готово', 'Оплачено', 'Выдано'].includes(currentStatus)) {
    throw new AppError('Нельзя отменить заявку на этом этапе', 400);
  }

  await pool.query(
    `UPDATE request SET status_id = $1 WHERE request_id = $2`,
    [cancelStatusId, requestId]
  );
}