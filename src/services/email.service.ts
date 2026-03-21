import nodemailer from 'nodemailer';
import config from '../config/config';
import logger from '../config/logger';
import { renderTemplate } from '../utils/template';

const transport = nodemailer.createTransport(config.email.smtp);

/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch(() =>
      logger.warn(
        'Unable to connect to email server. Make sure you have configured the SMTP options in .env'
      )
    );
}

const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  const msg = {
    from: config.email.from,
    to,
    subject,
    text,
    html
  };

  await transport.sendMail(msg);
};

const sendResetPasswordEmail = async (to: string, token: string) => {
  const subject = 'Đặt lại mật khẩu';
  const resetPasswordUrl = `${config.serverUrl}/v1/auth/reset-password-page?token=${token}`;

  const text = `Nhấn vào liên kết sau để đặt lại mật khẩu: ${resetPasswordUrl}`;

  const html = renderTemplate({
    title: 'Đặt lại mật khẩu',
    description: 'Email hỗ trợ đặt lại mật khẩu tài khoản của bạn.',
    content: '<p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><p>Nhấn nút bên dưới để tiếp tục.</p>',
    buttonText: 'Đặt lại mật khẩu',
    buttonUrl: resetPasswordUrl,
    headExtras: `<link rel="canonical" href="${resetPasswordUrl}" />`
  });

  await sendEmail(to, subject, text, html);
};

const sendVerificationEmail = async (to: string, token: string) => {
  const subject = 'Xác thực email';
  const verificationEmailUrl = `${config.serverUrl}/v1/auth/verify-email?token=${token}`;

  const text = `Nhấn vào liên kết sau để xác thực email: ${verificationEmailUrl}`;

  const html = renderTemplate({
    title: 'Xác thực email',
    description: 'Email xác thực địa chỉ email cho tài khoản của bạn.',
    content: '<p>Cảm ơn bạn đã đăng ký tài khoản.</p><p>Nhấn nút bên dưới để xác thực email.</p>',
    buttonText: 'Xác thực ngay',
    buttonUrl: verificationEmailUrl,
    headExtras: `<link rel="canonical" href="${verificationEmailUrl}" />`
  });

  await sendEmail(to, subject, text, html);
};

export default {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendVerificationEmail
};
