import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { authService, userService, tokenService, emailService } from '../services';
import exclude from '../utils/exclude';
import { User } from '@prisma/client';
import { successResponse } from '../utils/response';
import config from '../config/config';

const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  const user = await userService.createUser(email, password, name);
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);

  const userWithoutPassword = exclude(user, ['password']);
  const tokens = await tokenService.generateAuthTokens(user);

  res.status(httpStatus.CREATED).send(
    successResponse({
      code: httpStatus.CREATED,
      message: 'Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      data: {
        user: userWithoutPassword,
        tokens
      }
    })
  );
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.loginUserWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Đăng nhập thành công',
      data: {
        user,
        tokens
      }
    })
  );
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Đăng xuất thành công',
      data: null
    })
  );
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Làm mới token thành công',
      data: tokens
    })
  );
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Đã gửi email đặt lại mật khẩu',
      data: null
    })
  );
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Đặt lại mật khẩu thành công',
      data: null
    })
  );
});

const sendVerificationEmail = catchAsync(async (req, res) => {
  const user = req.user as User;
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Đã gửi email xác thực',
      data: null
    })
  );
});

const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token as string);

  return res.status(httpStatus.OK).send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Xác thực email thành công</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f9fc;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .card {
          background: white;
          padding: 32px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          max-width: 520px;
          text-align: center;
        }
        h1 { color: #16a34a; margin-bottom: 12px; }
        p { color: #334155; line-height: 1.6; }
        a {
          display: inline-block;
          margin-top: 16px;
          padding: 12px 20px;
          background: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 10px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Xác thực email thành công</h1>
        <p>Tài khoản của bạn đã được xác thực. Bạn có thể quay lại ứng dụng để tiếp tục sử dụng.</p>
        ${config.clientUrl ? `<a href="${config.clientUrl}">Mở ứng dụng</a>` : ''}
      </div>
    </body>
    </html>
  `);
});

export default {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail
};
