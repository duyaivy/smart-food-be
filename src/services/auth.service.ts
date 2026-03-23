import httpStatus from 'http-status';
import tokenService from './token.service';
import userService from './user.service';
import ApiError from '../utils/ApiError';
import { TokenType } from '@prisma/client';
import prisma from '../client';
import { encryptPassword, isPasswordMatch } from '../utils/encryption';
import { AuthTokensResponse } from '../types/response';
import exclude from '../utils/exclude';
import { IUser } from '../interfaces/user.interface';

const loginUserWithEmailAndPassword = async (
  email: string,
  password: string
): Promise<Omit<IUser, 'password'>> => {
  const user = await userService.getUserByEmail(email, [
    'id',
    'email',
    'name',
    'avatar',
    'password',
    'role',
    'isEmailVerified',
    'createdAt',
    'updatedAt',
    'height',
    'weight',
    'age'
  ]);

  if (!user || !(await isPasswordMatch(password, user.password as string))) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Email hoặc mật khẩu không chính xác');
  }

  return exclude(user, ['password']) as Omit<IUser, 'password'>;
};

const logout = async (refreshToken: string): Promise<void> => {
  const refreshTokenData = await prisma.token.findFirst({
    where: {
      token: refreshToken,
      type: TokenType.REFRESH,
      blacklisted: false
    }
  });

  if (!refreshTokenData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy refresh token');
  }

  await prisma.token.delete({ where: { id: refreshTokenData.id } });
};

const refreshAuth = async (refreshToken: string): Promise<AuthTokensResponse> => {
  try {
    const refreshTokenData = await tokenService.verifyToken(refreshToken, TokenType.REFRESH);
    const user = await userService.getUserById(refreshTokenData.userId, ['id', 'isEmailVerified']);

    if (!user) {
      throw new Error();
    }

    await prisma.token.delete({ where: { id: refreshTokenData.id } });
    return tokenService.generateAuthTokens({
      id: user.id,
      isEmailVerified: user.isEmailVerified
    });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Vui lòng đăng nhập');
  }
};

const resetPassword = async (resetPasswordToken: string, newPassword: string): Promise<void> => {
  try {
    const resetPasswordTokenData = await tokenService.verifyToken(
      resetPasswordToken,
      TokenType.RESET_PASSWORD
    );

    const user = await userService.getUserById(resetPasswordTokenData.userId);
    if (!user) {
      throw new Error();
    }

    await userService.updateUserById(user.id, { password: newPassword });
    await prisma.token.deleteMany({ where: { userId: user.id, type: TokenType.RESET_PASSWORD } });
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Đặt lại mật khẩu thất bại hoặc token không hợp lệ');
  }
};

const verifyEmail = async (verifyEmailToken: string): Promise<void> => {
  try {
    const verifyEmailTokenData = await tokenService.verifyToken(
      verifyEmailToken,
      TokenType.VERIFY_EMAIL
    );

    await prisma.token.deleteMany({
      where: { userId: verifyEmailTokenData.userId, type: TokenType.VERIFY_EMAIL }
    });

    await userService.updateUserById(verifyEmailTokenData.userId, { isEmailVerified: true });
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Xác thực email thất bại hoặc token không hợp lệ');
  }
};

export default {
  loginUserWithEmailAndPassword,
  isPasswordMatch,
  encryptPassword,
  logout,
  refreshAuth,
  resetPassword,
  verifyEmail
};
