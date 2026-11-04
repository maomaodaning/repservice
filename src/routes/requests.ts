import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { createRequest, getClientRequests, getRequestDetails, cancelRequest, payRequest, rateMaster } from '../services/requestService';
import { generateRequestPdf } from '../services/pdfService';

export const requestsRouter = Router();

requestsRouter.use(requireRole('client'));

requestsRouter.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await getClientRequests(req.session.user!.id, status);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post('/', async (req, res, next) => {
  try {
    const { problem_description, device } = req.body;
    if (!problem_description || !device || !device.type) {
      throw new AppError('Заполните описание неисправности и тип устройства', 400);
    }
    const result = await createRequest(req.session.user!.id, { problem_description, device });
    res.status(201).json({ request: result });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get('/:id', async (req, res, next) => {
  try {
    const request = await getRequestDetails(Number(req.params.id), req.session.user!.id);
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    await cancelRequest(Number(req.params.id), req.session.user!.id);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post('/:id/payment', async (req, res, next) => {
  try {
    const { amount, method } = req.body;
    if (!amount || !method) throw new AppError('Укажите сумму и способ оплаты', 400);
    await payRequest(req.session.user!.id, Number(req.params.id), { amount, method });
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

requestsRouter.post('/:id/rating', async (req, res, next) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) throw new AppError('Оценка от 1 до 5', 400);
    await rateMaster(req.session.user!.id, Number(req.params.id), rating);
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

requestsRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const pdfBuffer = await generateRequestPdf(Number(req.params.id));
    
    // Устанавливаем заголовки для скачивания файла
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${req.params.id}.pdf"`,
    });
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    next(err);
  }
});