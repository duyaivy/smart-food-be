import jwt from 'jsonwebtoken';
import moment, { Moment } from 'moment';
import httpStatus from 'http-status';
import config from '../config/config';
import userService from './user.service';
import ApiError from '../utils/apiError';
import { Token, TokenType } from '@prisma/client';
import prisma from '../client';
import { AuthTokensResponse } from '../models/types/response';

type JwtPayload = {
  sub: number;
  userId: number;
  isEmailVerified: boolean;
  iat: number;
  exp: number;
  type: TokenType;
};

type TokenUserInput = number | { id: number; isEmailVerified?: boolean };

const generateToken = (
  user: TokenUserInput,
  expires: Moment,
  type: TokenType,
  secret = config.jwt.secret
): string => {
  const userId = typeof user === 'number' ? user : user.id;
  const isEmailVerified = typeof user === 'number' ? false : user.isEmailVerified ?? false;

  const payload = {
    sub: userId,
    userId,
    isEmailVerified,
    iat: moment().unix(),
    exp: expires.unix(),
    type
  };

  return jwt.sign(payload, secret);
};

const saveToken = async (
  token: string,
  userId: number,
  expires: Moment,
  type: TokenType,
  blacklisted = false
): Promise<Token> => {
  return prisma.token.create({
    data: {
      token,
      userId,
      expires: expires.toDate(),
      type,
      blacklisted
    }
  });
};

const verifyToken = async (token: string, type: TokenType): Promise<Token> => {
  const payload = jwt.verify(token, config.jwt.secret) as unknown as JwtPayload;
  const userId = Number(payload.userId || payload.sub);

  const tokenData = await prisma.token.findFirst({
    where: { token, type, userId, blacklisted: false }
  });

  if (!tokenData) {
    throw new Error('Token not found');
  }

  return tokenData;
};

const generateAuthTokens = async (user: {
  id: number;
  isEmailVerified?: boolean;
}): Promise<AuthTokensResponse> => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user, accessTokenExpires, TokenType.ACCESS);

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(user, refreshTokenExpires, TokenType.REFRESH);
  await saveToken(refreshToken, user.id, refreshTokenExpires, TokenType.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate()
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate()
    }
  };
};

const generateResetPasswordToken = async (email: string): Promise<string> => {
  const user = await userService.getUserByEmail(email, ['id', 'isEmailVerified']);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy người dùng với email này');
  }

  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(
    { id: user.id as number, isEmailVerified: user.isEmailVerified as boolean },
    expires,
    TokenType.RESET_PASSWORD
  );

  await saveToken(resetPasswordToken, user.id as number, expires, TokenType.RESET_PASSWORD);
  return resetPasswordToken;
};

const generateVerifyEmailToken = async (user: {
  id: number;
  isEmailVerified?: boolean;
}): Promise<string> => {
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user, expires, TokenType.VERIFY_EMAIL);
  await saveToken(verifyEmailToken, user.id, expires, TokenType.VERIFY_EMAIL);
  return verifyEmailToken;
};

export default {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
  generateVerifyEmailToken
};
