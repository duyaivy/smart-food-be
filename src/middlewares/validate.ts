import httpStatus from 'http-status';
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import pick from '../utils/pick';

const validate = (schema: object) => (req: Request, res: Response, next: NextFunction) => {
  const validSchema = pick(schema, ['params', 'query', 'body']);
  const obj = pick(req, Object.keys(validSchema));

  const { value, error } = Joi.compile(validSchema)
    .prefs({
      errors: { label: 'key' },
      abortEarly: false
    })
    .validate(obj);

  if (error) {
    const fieldErrors: Record<string, string> = {};

    error.details.forEach((detail) => {
      const key = detail.path[detail.path.length - 1];

      if (key && !fieldErrors[String(key)]) {
        fieldErrors[String(key)] = detail.message;
      }
    });

    return res.status(httpStatus.UNPROCESSABLE_ENTITY).send({
      code: httpStatus.UNPROCESSABLE_ENTITY,
      message: 'Dữ liệu không hợp lệ',
      data: fieldErrors
    });
  }

  Object.assign(req, value);
  return next();
};

export default validate;
