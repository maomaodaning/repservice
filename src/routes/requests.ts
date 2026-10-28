import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { createRequest, getClientRequests, getRequestDetails, cancelRequest } from '../services/requestService';
import { AppError } from '../middleware/errorHandler';

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