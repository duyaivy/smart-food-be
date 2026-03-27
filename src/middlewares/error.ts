import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import ApiError from '../utils/apiError';
import { errorResponse } from '../utils/response';

export const errorConverter = (err: any, _req: Request, _res: Response, next: NextFunction) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode || error instanceof Error
        ? httpStatus.BAD_REQUEST
        : httpStatus.INTERNAL_SERVER_ERROR;

    error = new ApiError(statusCode, error.message || 'Có lỗi xảy ra');
  }

  next(error);
};

export const errorHandler = (err: ApiError, _req: Request, res: Response, _next: NextFunction) => {
  const { statusCode, message, data } = err;

  // Used by morgan's :message token for error logs
  res.locals.errorMessage = message;

  res.status(statusCode).send(
    errorResponse({
      code: statusCode,
      message,
      data: data ?? null
    })
  );
};
