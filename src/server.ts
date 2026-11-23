import dotenv from 'dotenv';
dotenv.config(); // <-- загружаем .env первым делом

import { app } from './app';
import { pool } from './db/pool';

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {

    //console.log('Email user:', process.env.EMAIL_USER);

    await pool.query('SELECT 1');
    console.log('PostgreSQL подключён');

    app.listen(port, () => {
      console.log(`Сервер запущен на http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Не удалось запустить сервер:', err);
    process.exit(1);
  }
}

start();