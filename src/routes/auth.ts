import { Router } from 'express';
import { authenticate, registerClient } from '../services/authService';
import { AppError } from '../middleware/errorHandler';

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const { full_name, phone, email, address, login, password } = req.body;
    if (!full_name || !phone || !login || !password) {
      throw new AppError('Заполните обязательные поля', 400);
    }
    const user = await registerClient({ full_name, phone, email, address, login, password });
    req.session.user = user;
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) throw new AppError('Введите логин и пароль', 400);
    
    const user = await authenticate(login, password);
    req.session.user = user;
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ status: 'ok' });
  });
});

authRouter.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.session.user });
});