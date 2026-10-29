import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

// === ЗАЯВКИ ===

export async function getAllRequests(filters?: { status?: string; master_id?: number }) {
  let query = `
    SELECT r.request_id, r.created_at, r.problem_description, r.total_cost,
           s.name AS status_name,
           c.full_name AS client_name,
           d.type AS device_type, d.brand AS device_brand, d.model AS device_model,
           m.full_name AS master_name, r.master_id
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