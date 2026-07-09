import { User } from '@prisma/client';
import httpStatus from 'http-status';
import { authService } from '../services/';
import { renderVerifyEmailSuccessPage } from '../utils/authPageRenderer';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';

const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(httpStatus.CREATED).send(
    successResponse({
      code: httpStatus.CREATED,
      message: 'Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      data: result
    })
  );
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Đăng nhập thành công',
      data: result
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
  await authService.forgotPassword(req.body.email);

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
  await authService.sendVerificationEmail(req.user as User);

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

  const html = renderVerifyEmailSuccessPage();

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
