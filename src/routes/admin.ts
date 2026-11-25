//admin.ts
import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { 
  getAllRequests, assignMaster, getAllMasters,
  getAllParts, createPart, supplyPart, getAllSuppliers,
  createPurchaseOrder, receivePurchaseOrder,
  getDeletedParts, movePartToTrash, restorePart, deletePartForever
} from '../services/adminService';
import { getRevenueReport, getRequestsReport, getMastersWorkload } from '../services/reportService';
import { createService, updateService, deleteService } from '../services/adminService';
import { pool } from '../db/pool';
import { getAllDiagnostics } from '../services/adminService';
import { updateRequestStatus } from '../services/adminService';
import { generateRequestPdf } from '../services/pdfService';
import { getStaffStats, updateMaster } from '../services/adminService';
import { createMaster } from '../services/authService';

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

// ===== СКЛАД =====

adminRouter.get('/parts', async (_req, res, next) => {
  try {
    const parts = await getAllParts();
    res.json({ parts });
  } catch (err) { next(err); }
});

adminRouter.post('/parts', async (req, res, next) => {
  try {
    const { name, article, quantity, price, min_quantity, supplier_id } = req.body;
    const part = await createPart({ name, article, quantity, price, min_quantity, supplier_id });
    res.status(201).json({ part });
  } catch (err) { next(err); }
});

adminRouter.post('/parts/:id/supply', async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) throw new Error('Количество должно быть больше 0');
    const part = await supplyPart(Number(req.params.id), quantity);
    res.json({ part });
  } catch (err) { next(err); }
});

// === НОВЫЕ РОУТЫ ДЛЯ КОРЗИНЫ ===

// Получить все запчасти в корзине
adminRouter.get('/parts/trash', async (_req, res, next) => {
  try {
    const parts = await getDeletedParts();
    res.json({ parts });
  } catch (err) { next(err); }
});

// Переместить в корзину (мягкое удаление)
adminRouter.delete('/parts/:id', async (req, res, next) => {
  try {
    await movePartToTrash(Number(req.params.id));
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
});

// Восстановить из корзины
adminRouter.put('/parts/:id/restore', async (req, res, next) => {
  try {
    await restorePart(Number(req.params.id));
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
});

// Удалить навсегда из БД
adminRouter.delete('/parts/:id/force', async (req, res, next) => {
  try {
    await deletePartForever(Number(req.params.id));
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
});

// ===== КОНЕЦ БЛОКА КОРЗИНЫ =====

adminRouter.get('/suppliers', async (_req, res, next) => {
  try {
    const suppliers = await getAllSuppliers();
    res.json({ suppliers });
  } catch (err) { next(err); }
});

// ===== ЗАКАЗЫ =====

adminRouter.post('/orders', async (req, res, next) => {
  try {
    const { supplier_id, items } = req.body;
    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Укажите поставщика и хотя бы одну позицию');
    }
    const order = await createPurchaseOrder(supplier_id, items);
    res.status(201).json({ order });
  } catch (err) { next(err); }
});

adminRouter.put('/orders/:id/receive', async (req, res, next) => {
  try {
    const result = await receivePurchaseOrder(Number(req.params.id));
    res.json(result);
  } catch (err) { next(err); }
});

// ===== ОТЧЁТЫ =====

adminRouter.get('/reports/revenue', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await getRevenueReport(from as string, to as string);
    res.json({ report: data });
  } catch (err) { next(err); }
});

adminRouter.get('/reports/requests', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await getRequestsReport(from as string, to as string);
    res.json({ report: data });
  } catch (err) { next(err); }
});

adminRouter.get('/reports/masters', async (_req, res, next) => {
  try {
    const data = await getMastersWorkload();
    res.json({ report: data });
  } catch (err) { next(err); }
});

// === УСЛУГИ ===
adminRouter.get('/services', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM service ORDER BY name');
    res.json({ services: result.rows });
  } catch (err) { next(err); }
});

adminRouter.post('/services', async (req, res, next) => {
  try { 
    const service = await createService(req.body); 
    res.status(201).json({ service }); 
  } catch (err) { next(err); }
});

adminRouter.put('/services/:id', async (req, res, next) => {
  try { 
    const service = await updateService(Number(req.params.id), req.body); 
    res.json({ service }); 
  } catch (err) { next(err); }
});

adminRouter.delete('/services/:id', async (req, res, next) => {
  try { 
    const result = await deleteService(Number(req.params.id)); 
    res.json(result); 
  } catch (err) { next(err); }
});

adminRouter.get('/diagnostics', async (_req, res, next) => {
  try {
    const diagnostics = await getAllDiagnostics();
    res.json({ diagnostics });
  } catch (err) { next(err); }
});

adminRouter.put('/requests/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) throw new Error('Укажите статус');
    await updateRequestStatus(Number(req.params.id), status);
    res.json({ status: 'ok' });
  } catch (err) { next(err); }
});

adminRouter.get('/requests/:id/pdf', async (req, res, next) => {
  try {
    const pdfBuffer = await generateRequestPdf(Number(req.params.id));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${req.params.id}.pdf"`,
    });
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    next(err);
  }
});

// === ПЕРСОНАЛ ===
adminRouter.get('/staff', async (_req, res, next) => {
  try {
    const staff = await getStaffStats();
    res.json({ staff });
  } catch (err) { next(err); }
});

adminRouter.put('/staff/:id', async (req, res, next) => {
  try {
    const result = await updateMaster(Number(req.params.id), req.body);
    res.json(result);
  } catch (err) { next(err); }
});

adminRouter.post('/staff', async (req, res, next) => {
  try {
    const { full_name, phone, specialization, login, password } = req.body;
    if (!full_name || !phone || !login || !password) {
      throw new Error('Заполните все обязательные поля');
    }
    
    const master = await createMaster({ full_name, phone, specialization, login, password });
    res.status(201).json({ master });
  } catch (err) { 
    next(err); 
  }
});