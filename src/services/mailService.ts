// src/services/emailService.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

export async function sendEmail(to: string, subject: string, text: string) {
  try {
    const info = await transporter.sendMail({
      from: `"Ремонт цифровой техники" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log('Письмо отправлено:', info.messageId);
    return true;
  } catch (err) {
    console.error('Ошибка отправки письма:', err);
    return false;
  }
}