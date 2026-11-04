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
    WHERE r.master_id = $1 AND s.name != 'Выдано'  -- ДОБАВИЛИ ЭТО УСЛОВИЕ
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

  // НОВАЯ ПРОВЕРКА: если ставим "Готово", проверяем отчёт и стоимость
  if (statusName === 'Готово') {
    const reportRes = await pool.query(
      'SELECT labor_cost FROM work_report WHERE request_id = $1',
      [requestId]
    );
    
    // Если отчёта нет ИЛИ стоимость не указана (null) ИЛИ она <= 0
    if (reportRes.rows.length === 0 || !reportRes.rows[0].labor_cost || Number(reportRes.rows[0].labor_cost) <= 0) {
      throw new AppError('Нельзя завершить ремонт без указания стоимости работ. Сначала внесите отчёт.', 400);
    }
  }

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
  parts: { part_id: number; quantity: number }[];
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Проверяем, что заявка у этого мастера
    const check = await client.query(
      'SELECT request_id FROM request WHERE request_id = $1 AND master_id = $2',
      [requestId, masterId]
    );
    if (check.rows.length === 0) throw new AppError('Заявка не найдена', 404);

    // 2. Создаём отчёт
    const res = await client.query(
      `INSERT INTO work_report (request_id, master_id, work_description, labor_cost)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [requestId, masterId, data.work_description, data.labor_cost]
    );

    // 3. Обновляем итоговую стоимость заявки (работа + запчасти)
    let totalCost = Number(data.labor_cost);

    // 4. Списываем запчасти
    if (data.parts && data.parts.length > 0) {
      for (const item of data.parts) {
        // Блокируем строку и проверяем остаток
        const partRes = await client.query(
          'SELECT quantity, price, name FROM part WHERE part_id = $1 FOR UPDATE',
          [item.part_id]
        );
        
        if (partRes.rows.length === 0) {
          throw new AppError(`Запчасть с ID ${item.part_id} не найдена`, 404);
        }

        const part = partRes.rows[0];
        if (part.quantity < item.quantity) {
          throw new AppError(`Недостаточно запчастей "${part.name}" на складе (осталось: ${part.quantity})`, 400);
        }

        // Списываем со склада
        await client.query(
          'UPDATE part SET quantity = quantity - $1 WHERE part_id = $2',
          [item.quantity, item.part_id]
        );

        // Записываем в request_part
        await client.query(
          `INSERT INTO request_part (request_id, part_id, quantity, price_at_moment)
           VALUES ($1, $2, $3, $4)`,
          [requestId, item.part_id, item.quantity, part.price]
        );

        // Добавляем к общей стоимости
        totalCost += Number(part.price) * item.quantity;
      }
    }

    // 5. Обновляем итоговую стоимость заявки
    await client.query(
      'UPDATE request SET total_cost = $1 WHERE request_id = $2',
      [totalCost, requestId]
    );

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getMasterReports(masterId: number) {
  const query = `
    SELECT 
      wr.report_id,
      wr.report_date,
      wr.work_description,
      wr.labor_cost,
      r.request_id,
      r.problem_description,
      d.type AS device_type,
      d.brand AS device_brand,
      s.name AS status_name
    FROM work_report wr
    JOIN request r ON r.request_id = wr.request_id
    JOIN device d ON d.device_id = r.device_id
    JOIN status s ON s.status_id = r.status_id
    WHERE wr.master_id = $1
    ORDER BY wr.report_date DESC
  `;
  const result = await pool.query(query, [masterId]);
  return result.rows;
}