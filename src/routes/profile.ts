import { Router } from 'express';
import { pool } from '../db/pool';
import { requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const profileRouter = Router();

profileRouter.use(requireRole('client'));

profileRouter.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT client_id, full_name, phone, email, address, login
       FROM client WHERE client_id = $1`,
      [req.session.user!.id]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

profileRouter.put('/', async (req, res, next) => {
  try {
    const { full_name, phone, email, address } = req.body;
    if (!full_name || !phone) {
      throw new AppError('ФИО и телефон обязательны', 400);
    }
    const result = await pool.query(
      `UPDATE client
       SET full_name = $1, phone = $2, email = $3, address = $4
       WHERE client_id = $5
       RETURNING client_id, full_name, phone, email, address, login`,
      [full_name, phone, email || null, address || null, req.session.user!.id]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    next(err);
  }
});