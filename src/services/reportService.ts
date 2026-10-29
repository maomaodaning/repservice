import { pool } from '../db/pool';

export async function getRevenueReport(from?: string, to?: string) {
  let query = `
    SELECT 
      DATE(payment_date) as date,
      SUM(amount) as total_amount,
      COUNT(*) as payments_count
    FROM payment
    WHERE status = 'completed'
  `;
  const params: any[] = [];
  
  if (from) {
    params.push(from);
    query += ` AND payment_date >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    query += ` AND payment_date <= $${params.length}`;
  }
  
  query += ` GROUP BY DATE(payment_date) ORDER BY date DESC`;
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getRequestsReport(from?: string, to?: string) {
  let query = `
    SELECT 
      s.name as status_name,
      COUNT(r.request_id) as count
    FROM request r
    JOIN status s ON s.status_id = r.status_id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (from) {
    params.push(from);
    query += ` AND r.created_at >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    query += ` AND r.created_at <= $${params.length}`;
  }
  
  query += ` GROUP BY s.name ORDER BY count DESC`;
  
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getMastersWorkload() {
  const query = `
    SELECT 
      m.master_id,
      m.full_name,
      m.rating,
      COUNT(r.request_id) as total_requests,
      COUNT(CASE WHEN s.name IN ('Готово', 'Оплачено', 'Выдано') THEN 1 END) as completed_requests
    FROM master m
    LEFT JOIN request r ON r.master_id = m.master_id
    LEFT JOIN status s ON s.status_id = r.status_id
    GROUP BY m.master_id, m.full_name, m.rating
    ORDER BY completed_requests DESC
  `;
  const result = await pool.query(query);
  return result.rows;
}