import nodemailer from 'nodemailer';
import config from '../config/config';
import logger from '../config/logger';

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

const buildEmailLayout = (
  title: string,
  content: string,
  buttonText: string,
  buttonUrl: string
) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
    <h2 style="margin-top:0;color:#111827;">${title}</h2>
    <div style="color:#374151;font-size:15px;line-height:1.7;">
      ${content}
    </div>
    <div style="margin-top:24px;">
      <a href="${buttonUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;">
        ${buttonText}
      </a>
    </div>
    <p style="margin-top:24px;color:#6b7280;font-size:13px;">
      Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
    </p>
  </div>
</body>
</html>
`;

const sendResetPasswordEmail = async (to: string, token: string) => {
  const subject = 'Đặt lại mật khẩu';
  const resetPasswordUrl = `${config.serverUrl}/v1/auth/reset-password-page?token=${token}`;

  const text = `Nhấn vào liên kết sau để đặt lại mật khẩu: ${resetPasswordUrl}`;
  const html = buildEmailLayout(
    'Đặt lại mật khẩu',
    '<p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><p>Nhấn nút bên dưới để tiếp tục.</p>',
    'Đặt lại mật khẩu',
    resetPasswordUrl
  );

  await sendEmail(to, subject, text, html);
};

const sendVerificationEmail = async (to: string, token: string) => {
  const subject = 'Xác thực email';
  const verificationEmailUrl = `${config.serverUrl}/v1/auth/verify-email?token=${token}`;

  const text = `Nhấn vào liên kết sau để xác thực email: ${verificationEmailUrl}`;
  const html = buildEmailLayout(
    'Xác thực email',
    '<p>Cảm ơn bạn đã đăng ký tài khoản.</p><p>Nhấn nút bên dưới để xác thực email.</p>',
    'Xác thực ngay',
    verificationEmailUrl
  );

  await sendEmail(to, subject, text, html);
};

export default {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendVerificationEmail
};
