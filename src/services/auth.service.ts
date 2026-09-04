import { Role, TokenType, User } from '@prisma/client';
import httpStatus from 'http-status';
import tokenService from './token.service';
import userService from './user/user.service';
import emailService from './email.service';
import ApiError from '../utils/apiError';
import { isPasswordMatch } from '../utils/encryption';
import { AuthTokensResponse } from '../models/types/response';
import exclude from '../utils/exclude';
import { IUser } from '../models/interfaces/user.interface';

const toAuthUser = (user: User): Omit<IUser, 'password'> => {
  return exclude(user, ['password']) as Omit<IUser, 'password'>;
};

const register = async (
  input: Pick<IUser, 'name' | 'email'> & {
    password: string;
    avatar?: IUser['avatar'];
    height?: IUser['height'];
    weight?: IUser['weight'];
    sex?: IUser['sex'];
    birthday?: IUser['birthday'] | string;
  }
): Promise<{ user: Omit<IUser, 'password'>; tokens: AuthTokensResponse }> => {
  const user = await userService.createUser({
    name: input.name,
    email: input.email,
    password: input.password,
    role: Role.USER,
    avatar: input.avatar ?? null,
    height: input.height ?? null,
    weight: input.weight ?? null,
    sex: input.sex ?? null,
    birthday: input.birthday ?? null
  });

  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);

  const tokens = await tokenService.generateAuthTokens(user);

  return {
    user: toAuthUser(user),
    tokens
  };
};

const login = async (
  email: string,
  password: string
): Promise<{ user: Omit<IUser, 'password'>; tokens: AuthTokensResponse }> => {
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
    'sex',
    'birthday',
    'activityLevel'
  ]);

  if (!user || !(await isPasswordMatch(password, user.password as string))) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Email hoặc mật khẩu không chính xác');
  }

  const authUser = exclude(user, ['password']) as Omit<IUser, 'password'>;
  const tokens = await tokenService.generateAuthTokens({
    id: authUser.id,
    isEmailVerified: authUser.isEmailVerified
  });

  return {
    user: authUser,
    tokens
  };
};

const logout = async (refreshToken: string): Promise<void> => {
  const refreshTokenData = await tokenService.findValidToken(refreshToken, TokenType.REFRESH);

  if (!refreshTokenData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy refresh token');
  }

  await tokenService.revokeTokenById(refreshTokenData.id);
};

const refreshAuth = async (refreshToken: string): Promise<AuthTokensResponse> => {
  try {
    const refreshTokenData = await tokenService.verifyToken(refreshToken, TokenType.REFRESH);
    const user = await userService.getUserById(refreshTokenData.userId, ['id', 'isEmailVerified']);

    if (!user) {
      throw new Error();
    }

    await tokenService.revokeTokenById(refreshTokenData.id);
    return tokenService.generateAuthTokens({
      id: user.id,
      isEmailVerified: user.isEmailVerified
    });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Vui lòng đăng nhập');
  }
};

const forgotPassword = async (email: string): Promise<void> => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(email);
  await emailService.sendResetPasswordEmail(email, resetPasswordToken);
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
    await tokenService.revokeUserTokens(user.id, TokenType.RESET_PASSWORD);
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Đặt lại mật khẩu thất bại hoặc token không hợp lệ');
  }
};

const sendVerificationEmail = async (
  user: Pick<User, 'id' | 'email' | 'isEmailVerified'>
): Promise<void> => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);
};

const verifyEmail = async (verifyEmailToken: string): Promise<void> => {
  try {
    const verifyEmailTokenData = await tokenService.verifyToken(
      verifyEmailToken,
      TokenType.VERIFY_EMAIL
    );

    await userService.updateUserById(verifyEmailTokenData.userId, { isEmailVerified: true });
    await tokenService.revokeUserTokens(verifyEmailTokenData.userId, TokenType.VERIFY_EMAIL);
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Xác thực email thất bại hoặc token không hợp lệ');
  }
};

export default {
  register,
  login,
  logout,
  refreshAuth,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail
};
