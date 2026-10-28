import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.user) {
    return next(new AppError('Требуется авторизация', 401));
  }
  next();
}

export function requireRole(...roles: Array<'client' | 'master' | 'admin'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return next(new AppError('Требуется авторизация', 401));
    }
    if (!roles.includes(req.session.user.role)) {
      return next(new AppError('Доступ запрещён', 403));
    }
    next();
  };
}