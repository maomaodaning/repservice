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

console.log('static path:', path.join(__dirname, '..', 'public'));
console.log('static middleware:', typeof express.static(path.join(__dirname, '..', 'public')));

app.use(express.static(path.join(__dirname, '..', 'public')));

console.log('session type:', typeof session);

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

console.log('authRouter type:', typeof authRouter);

app.use('/api/auth', authRouter);
app.use('/api/services', servicesRouter);
app.use('/api/profile', profileRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/master', masterRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);