import passport from 'passport';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';
import { roleRights } from '../config/roles';
import { NextFunction, Request, Response } from 'express';
import { User } from '@prisma/client';
import logger from '../config/logger';

const verifyCallback =
  (
    req: any,
    resolve: (value?: unknown) => void,
    reject: (reason?: unknown) => void,
    requiredRights: string[]
  ) =>
  async (
    err: unknown,
    user: (Pick<User, 'id' | 'role' | 'isEmailVerified'> & Record<string, unknown>) | false,
    info: unknown
  ) => {
    if (err || info || !user) {
      return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Vui lòng đăng nhập'));
    }
    req.user = user;
    req.userId = user.id;

    if (!user.isEmailVerified) {
      const email = typeof (user as any).email === 'string' ? (user as any).email : undefined;
      logger.warn(
        'Unauthorized (email not verified): %s %s userId=%s role=%s email=%s',
        req.method,
        req.originalUrl || req.url,
        user.id,
        String(user.role),
        email ?? ''
      );
      return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Email is not verified'));
    }

    if (requiredRights.length) {
      const userRights = roleRights.get(user.role) ?? [];
      const hasRequiredRights = requiredRights.every((requiredRight) =>
        userRights.includes(requiredRight)
      );

      const requestedUserId = Number(req.params?.userId);
      const isOwnResource = Number.isFinite(requestedUserId) && requestedUserId === user.id;
      if (!hasRequiredRights && !isOwnResource) {
        const email = typeof (user as any).email === 'string' ? (user as any).email : undefined;
        logger.warn(
          'Forbidden: %s %s userId=%s role=%s email=%s requiredRights=%j userRights=%j requestedUserId=%s',
          req.method,
          req.originalUrl || req.url,
          user.id,
          String(user.role),
          email ?? '',
          requiredRights,
          userRights,
          Number.isFinite(requestedUserId) ? requestedUserId : null
        );
        return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
      }
    }

    resolve();
  };

const auth =
  (...requiredRights: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    return new Promise((resolve, reject) => {
      passport.authenticate(
        'jwt',
        { session: false },
        verifyCallback(req, resolve, reject, requiredRights)
      )(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };

export default auth;
