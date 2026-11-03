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

export async function payRequest(clientId: number, requestId: number, data: { amount: number; method: string; }) {
  const check = await pool.query(
    `SELECT r.request_id, s.name AS status_name, r.total_cost
     FROM request r JOIN status s ON s.status_id = r.status_id 
     WHERE r.request_id = $1 AND r.client_id = $2`,
    [requestId, clientId]
  );
  
  if (check.rows.length === 0) throw new AppError('Заявка не найдена', 404);
  
  const req = check.rows[0];
  
  // 1. Проверка статуса (нельзя оплатить дважды)
  if (req.status_name === 'Оплачено' || req.status_name === 'Выдано') {
    throw new AppError('Заявка уже оплачена', 400);
  }
  if (req.status_name !== 'Готово') {
    throw new AppError('Оплатить можно только готовую заявку', 400);
  }
  
  // 2. Проверка суммы
  if (!req.total_cost || Number(req.total_cost) <= 0) {
    throw new AppError('Неверное значение суммы, обратитесь в сервисный центр', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO payment (request_id, amount, method, status) VALUES ($1, $2, $3, 'completed')`,
      [requestId, data.amount, data.method]
    );
    await client.query(
      `UPDATE request SET status_id = (SELECT status_id FROM status WHERE name = 'Оплачено') WHERE request_id = $1`,
      [requestId]
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

export async function rateMaster(clientId: number, requestId: number, rating: number) {
  // проверяем, что заявка принадлежит клиенту и она оплачена
  const check = await pool.query(
    `SELECT r.master_id, s.name AS status_name 
     FROM request r JOIN status s ON s.status_id = r.status_id 
     WHERE r.request_id = $1 AND r.client_id = $2`,
    [requestId, clientId]
  );

  if (check.rows.length === 0) throw new AppError('Заявка не найдена', 404);
  if (check.rows[0].status_name !== 'Оплачено') {
    throw new AppError('Оценить ремонт можно только после оплаты', 400);
  }
  
  const masterId = check.rows[0].master_id;
  if (!masterId) throw new AppError('Мастер не назначен', 400);

  // Обновляем рейтинг мастера (простое среднее: (старый + новый) / 2)
  // В идеале нужно хранить все оценки, но мы договорились без отдельной таблицы
  await pool.query(
    `UPDATE master 
     SET rating = CASE 
       WHEN rating = 0 THEN $1 
       ELSE ROUND((rating + $1) / 2, 2) 
     END
     WHERE master_id = $2`,
    [rating, masterId]
  );
  
  return { status: 'ok' };
}