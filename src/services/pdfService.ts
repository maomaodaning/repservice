import puppeteer from 'puppeteer';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

export async function generateRequestPdf(requestId: number) {
  // 1. Получаем все данные по заявке
  const reqRes = await pool.query(
    `SELECT r.*, s.name AS status_name, 
            c.full_name AS client_name, c.phone AS client_phone,
            d.type AS device_type, d.brand AS device_brand, d.model AS device_model, d.serial_number,
            m.full_name AS master_name
     FROM request r
     JOIN status s ON s.status_id = r.status_id
     JOIN client c ON c.client_id = r.client_id
     JOIN device d ON d.device_id = r.device_id
     LEFT JOIN master m ON m.master_id = r.master_id
     WHERE r.request_id = $1`,
    [requestId]
  );
  if (reqRes.rows.length === 0) throw new AppError('Заявка не найдена', 404);
  const req = reqRes.rows[0];

  const diagRes = await pool.query('SELECT * FROM diagnostic WHERE request_id = $1', [requestId]);
  const reportRes = await pool.query('SELECT * FROM work_report WHERE request_id = $1', [requestId]);
  const partsRes = await pool.query(
    `SELECT rp.quantity, rp.price_at_moment, p.name AS part_name 
     FROM request_part rp JOIN part p ON p.part_id = rp.part_id 
     WHERE rp.request_id = $1`,
    [requestId]
  );
  const paymentsRes = await pool.query('SELECT * FROM payment WHERE request_id = $1', [requestId]);

  const diag = diagRes.rows[0];
  const report = reportRes.rows[0];
  const parts = partsRes.rows;
  const payments = paymentsRes.rows;

  // 2. Формируем HTML-шаблон
  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; }
        h1 { text-align: center; font-size: 22px; margin-bottom: 5px; }
        h2 { font-size: 16px; border-bottom: 1px solid #000; padding-bottom: 3px; margin-top: 20px; }
        .subtitle { text-align: center; font-size: 12px; color: #555; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 14px; }
        th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; }
        th { background-color: #eee; }
        .total { font-size: 16px; font-weight: bold; text-align: right; margin-top: 10px; }
      </style>
    </head>
    <body>
      <h1>Отчёт о выполненных работах</h1>
      <div class="subtitle">Заявка №${req.request_id} от ${new Date(req.created_at).toLocaleDateString('ru-RU')}</div>

      <h2>Информация о заявке</h2>
      <table>
        <tr><td width="30%"><b>Клиент:</b></td><td>${req.client_name} (${req.client_phone})</td></tr>
        <tr><td><b>Устройство:</b></td><td>${req.device_type} ${req.device_brand || ''} ${req.device_model || ''} (S/N: ${req.serial_number || '—'})</td></tr>
        <tr><td><b>Неисправность:</b></td><td>${req.problem_description}</td></tr>
        <tr><td><b>Статус:</b></td><td>${req.status_name}</td></tr>
        <tr><td><b>Мастер:</b></td><td>${req.master_name || 'Не назначен'}</td></tr>
      </table>

      ${diag ? `
      <h2>Диагностика</h2>
      <table>
        <tr><td width="30%"><b>Дата:</b></td><td>${new Date(diag.diagnostic_date).toLocaleString('ru-RU')}</td></tr>
        <tr><td><b>Результат:</b></td><td>${diag.result}</td></tr>
        <tr><td><b>Рекомендации:</b></td><td>${diag.recommended_actions || '—'}</td></tr>
      </table>` : ''}

      ${report ? `
      <h2>Отчёт о работах</h2>
      <table>
        <tr><td width="30%"><b>Дата:</b></td><td>${new Date(report.report_date).toLocaleString('ru-RU')}</td></tr>
        <tr><td><b>Что сделано:</b></td><td>${report.work_description}</td></tr>
        <tr><td><b>Стоимость работ:</b></td><td>${report.labor_cost} BYN</td></tr>
      </table>` : '<p>Отчёт о работах ещё не составлен.</p>'}

      ${parts.length > 0 ? `
      <h2>Использованные запчасти</h2>
      <table>
        <thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена за ед.</th><th>Сумма</th></tr></thead>
        <tbody>
          ${parts.map(p => `
            <tr>
              <td>${p.part_name}</td>
              <td>${p.quantity}</td>
              <td>${p.price_at_moment} BYN</td>
              <td>${(p.quantity * p.price_at_moment).toFixed(2)} BYN</td>
            </tr>
          `).join('')}
        </tbody>
      </table>` : ''}

      ${payments.length > 0 ? `
      <h2>Оплата</h2>
      <table>
        <thead><tr><th>Дата</th><th>Сумма</th><th>Способ</th></tr></thead>
        <tbody>
          ${payments.map(p => `
            <tr><td>${new Date(p.payment_date).toLocaleString('ru-RU')}</td><td>${p.amount} BYN</td><td>${p.method}</td></tr>
          `).join('')}
        </tbody>
      </table>` : ''}

      <div class="total">
        Итоговая стоимость: ${req.total_cost ? req.total_cost + ' BYN' : 'не определена'}
      </div>
    </body>
    </html>
  `;

  // 3. Запускаем Puppeteer и генерируем PDF
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
  });

  await browser.close();
  return pdfBuffer;
}