import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { getAllRequests, assignMaster, getAllMasters } from '../services/adminService';

export const adminRouter = Router();

// Все роуты здесь требуют роль admin
adminRouter.use(requireRole('admin'));

// Получить все заявки (можно фильтровать: ?status=Новая)
adminRouter.get('/requests', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      master_id: req.query.master_id ? Number(req.query.master_id) : undefined,
    };
    const requests = await getAllRequests(filters);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// Назначить мастера на заявку
adminRouter.put('/requests/:id/assign', async (req, res, next) => {
  try {
    const { master_id } = req.body;
    if (!master_id) throw new Error('Укажите master_id');
    
    await assignMaster(Number(req.params.id), master_id);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

// Получить список всех мастеров
adminRouter.get('/masters', async (_req, res, next) => {
  try {
    const masters = await getAllMasters();
    res.json({ masters });
  } catch (err) {
    next(err);
  }
});