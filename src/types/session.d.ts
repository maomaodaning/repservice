import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      role: 'client' | 'master' | 'admin';
    };
  }
}