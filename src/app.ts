import express from 'express';
import path from 'path';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Сюда будут монтироваться роуты

app.use(errorHandler);