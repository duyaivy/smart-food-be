import Joi from 'joi';
import { CookingStatus } from '@prisma/client';
import { CookingSortBy } from '../models/interfaces/cooking.interface';

const createCooking = {
  body: Joi.object({
    dishId: Joi.number().integer().required()
  })
};

const getCookings = {
  query: Joi.object({
    status: Joi.string()
      .custom((value, helpers) => {
        const statuses = String(value)
          .split(',')
          .map((status) => status.trim())
          .filter(Boolean);

        const isValid = statuses.every((status) =>
          Object.values(CookingStatus).includes(status as CookingStatus)
        );

        if (!isValid) {
          return helpers.error('any.invalid');
        }

        return value;
      })
      .optional(),
    sortBy: Joi.string()
      .valid(...Object.values(CookingSortBy))
      .optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional()
  })
};

const getCookingById = {
  params: Joi.object({
    cookingId: Joi.number().integer().required()
  })
};

const completeCooking = getCookingById;

const cancelCooking = getCookingById;

export default {
  createCooking,
  getCookings,
  getCookingById,
  completeCooking,
  cancelCooking
};
