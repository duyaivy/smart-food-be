import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { authService, userService, tokenService, emailService } from '../services';
import exclude from '../utils/exclude';
import { User } from '@prisma/client';
import { successResponse } from '../utils/response';
import config from '../config/config';
import { renderTemplate } from '../utils/template';

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

  const appUrl = config.clientUrl || '';

  const html = renderTemplate({
    title: 'Xác thực email thành công',
    description: 'Tài khoản của bạn đã được xác thực thành công.',
    content:
      '<p>Tài khoản của bạn đã được xác thực. Bạn có thể quay lại ứng dụng để tiếp tục sử dụng.</p>',
    buttonText: appUrl ? 'Mở ứng dụng' : '',
    buttonUrl: appUrl,
    headExtras: appUrl
      ? `<link rel="canonical" href="${appUrl}" />
         <meta property="og:url" content="${appUrl}" />`
      : ''
  });

  return res.status(httpStatus.OK).send(html);
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
