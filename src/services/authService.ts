import bcrypt from 'bcrypt';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { UserRole } from '../types';

interface FoundUser {
  id: number;
  password_hash: string;
  role: UserRole;
}

async function findByLogin(login: string): Promise<FoundUser | null> {
  const queries = [
    { table: 'client', idCol: 'client_id', role: 'client' as UserRole },
    { table: 'master', idCol: 'master_id', role: 'master' as UserRole },
    { table: 'admin', idCol: 'admin_id', role: 'admin' as UserRole },
  ];

  for (const q of queries) {
    const res = await pool.query(
      `SELECT ${q.idCol} AS id, password_hash FROM ${q.table} WHERE login = $1`,
      [login]
    );
    if (res.rows.length > 0) {
      return { id: res.rows[0].id, password_hash: res.rows[0].password_hash, role: q.role };
    }
  }
  return null;
}

export async function authenticate(login: string, password: string) {
  const user = await findByLogin(login);
  if (!user) throw new AppError('Неверный логин или пароль', 401);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Неверный логин или пароль', 401);

  return { id: user.id, role: user.role };
}
export async function registerClient(data: {
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  login: string;
  password: string;
}) {
  // проверка, что логин свободен во всех трёх таблицах
  const existing = await findByLogin(data.login);
  if (existing) throw new AppError('Логин уже занят', 400);

  const hash = await bcrypt.hash(data.password, 10);
  const res = await pool.query(
    `INSERT INTO client (full_name, phone, email, address, login, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING client_id`,
    [data.full_name, data.phone, data.email || null, data.address || null, data.login, hash]
  );
  return { id: res.rows[0].client_id, role: 'client' as UserRole };
}