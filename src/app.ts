import { authRouter } from './routes/auth';
import express from 'express';
import path from 'path';
import session from 'express-session';
import { errorHandler } from './middleware/errorHandler';
import { servicesRouter } from './routes/services';
import { profileRouter } from './routes/profile';
import { requestsRouter } from './routes/requests';
import { masterRouter } from './routes/master';
import { adminRouter } from './routes/admin';

export const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

// Настройка сессий
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,    // защита от XSS
    maxAge: 1000 * 60 * 60 * 24, // 24 часа
  },
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/services', servicesRouter);
app.use('/api/profile', profileRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/master', masterRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);