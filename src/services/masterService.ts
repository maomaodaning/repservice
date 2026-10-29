import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

export async function getMasterRequests(masterId: number, statusName?: string) {
  let query = `
    SELECT r.request_id, r.created_at, r.problem_description,
           s.name AS status_name,
           d.type AS device_type, d.brand AS device_brand, d.model AS device_model
    FROM request r
    JOIN status s ON s.status_id = r.status_id
    JOIN device d ON d.device_id = r.device_id
    WHERE r.master_id = $1
  `;
  const params: any[] = [masterId];

  if (statusName) {
    query += ` AND s.name = $2`;
    params.push(statusName);
  }

  query += ` ORDER BY r.created_at DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}

export async function createDiagnostic(masterId: number, requestId: number, data: {
  result: string;
  recommended_actions?: string;
  estimated_cost?: number;
}) {
  const check = await pool.query(
    'SELECT request_id FROM request WHERE request_id = $1 AND master_id = $2',
    [requestId, masterId]
  );
  if (check.rows.length === 0) throw new AppError('Заявка не найдена', 404);

  const res = await pool.query(
    `INSERT INTO diagnostic (request_id, result, recommended_actions, estimated_cost)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [requestId, data.result, data.recommended_actions || null, data.estimated_cost || null]
  );
  return res.rows[0];
}

export async function updateStatus(masterId: number, requestId: number, statusName: string) {
  const check = await pool.query(
    'SELECT request_id FROM request WHERE request_id = $1 AND master_id = $2',
    [requestId, masterId]
  );
  if (check.rows.length === 0) throw new AppError('Заявка не найдена', 404);

  const statusRes = await pool.query('SELECT status_id FROM status WHERE name = $1', [statusName]);
  if (statusRes.rows.length === 0) throw new AppError('Статус не найден', 400);
  const statusId = statusRes.rows[0].status_id;

  let completedAtSql = '';
  if (statusName === 'Готово') {
    completedAtSql = ', completed_at = NOW()';
  }

  const res = await pool.query(
    `UPDATE request SET status_id = $1 ${completedAtSql} WHERE request_id = $2 RETURNING request_id`,
    [statusId, requestId]
  );
  return res.rows[0];
}

export async function createReport(masterId: number, requestId: number, data: {
  work_description: string;
  labor_cost: number;
}) {
  const check = await pool.query(
    'SELECT request_id FROM request WHERE request_id = $1 AND master_id = $2',
    [requestId, masterId]
  );
  if (check.rows.length === 0) throw new AppError('Заявка не найдена', 404);

  const res = await pool.query(
    `INSERT INTO work_report (request_id, master_id, work_description, labor_cost)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [requestId, masterId, data.work_description, data.labor_cost]
  );

  await pool.query(
    'UPDATE request SET total_cost = $1 WHERE request_id = $2',
    [data.labor_cost, requestId]
  );

  return res.rows[0];
}