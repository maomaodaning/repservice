const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // для порта 587 используется STARTTLS
  auth: {
    user: 'repairservice420604@gmail.com',
    pass: 'xpdf zdio jqry wwul' // НЕ обычный пароль
  }
});

transporter.sendMail({
  from: '"Ремонт цифровой техники" <repairservice420604@gmail.com>',
  to: 'timofeisavin1909@gmail.com',
  subject: 'Тестовое письмо',
  text: 'Привет из Nodemailer!'
}).then(info => console.log('Письмо отправлено:', info.messageId))
  .catch(err => console.error('Ошибка:', err));