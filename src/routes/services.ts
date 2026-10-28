import { Router } from 'express';
import { pool } from '../db/pool';

export const servicesRouter = Router();

servicesRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT service_id, name, price, duration FROM service ORDER BY name'
    );
    res.json({ services: result.rows });
  } catch (err) {
    next(err);
  }
});

servicesRouter.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT service_id, name, price, duration FROM service WHERE service_id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Услуга не найдена' } });
    }
    res.json({ service: result.rows[0] });
  } catch (err) {
    next(err);
  }
});