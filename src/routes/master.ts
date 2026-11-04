import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { getMasterRequests, createDiagnostic, updateStatus, createReport, getMasterReports } from '../services/masterService';
import { AppError } from '../middleware/errorHandler';
import { getAllDiagnostics } from '../services/adminService';
import { pool } from '../db/pool';
import { generateRequestPdf } from '../services/pdfService';

export const masterRouter = Router();

masterRouter.use(requireRole('master'));

masterRouter.get('/requests', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await getMasterRequests(req.session.user!.id, status);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

masterRouter.post('/requests/:id/diagnostic', async (req, res, next) => {
  try {
    const { result, recommended_actions, estimated_cost } = req.body;
    if (!result) throw new AppError('Результат диагностики обязателен', 400);
    
    const diagnostic = await createDiagnostic(req.session.user!.id, Number(req.params.id), {
      result, recommended_actions, estimated_cost,
    });
    res.status(201).json({ diagnostic });
  } catch (err) {
    next(err);
  }
});

masterRouter.put('/requests/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) throw new AppError('Укажите статус', 400);
    
    await updateStatus(req.session.user!.id, Number(req.params.id), status);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

masterRouter.post('/requests/:id/report', async (req, res, next) => {
  try {
    const { work_description, labor_cost, parts } = req.body;
    if (!work_description || labor_cost === undefined) {
      throw new AppError('Описание работ и стоимость обязательны', 400);
    }
    
    // Передаем parts (если их нет, будет пустой массив)
    const report = await createReport(req.session.user!.id, Number(req.params.id), {
      work_description, 
      labor_cost: Number(labor_cost),
      parts: parts || [] 
    });
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
});

masterRouter.get('/diagnostics', async (_req, res, next) => {
  try {
    const diagnostics = await getAllDiagnostics();
    res.json({ diagnostics });
  } catch (err) { next(err); }
});

masterRouter.get('/reports', async (req, res, next) => {
  try {
    const reports = await getMasterReports(req.session.user!.id);
    res.json({ reports });
  } catch (err) { next(err); }
});

masterRouter.get('/parts', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT part_id, name, quantity, price FROM part ORDER BY name');
    res.json({ parts: result.rows });
  } catch (err) { next(err); }
});

masterRouter.get('/requests/:id/pdf', async (req, res, next) => {
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