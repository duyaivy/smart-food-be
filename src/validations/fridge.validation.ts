import { Priority } from '@prisma/client';
import Joi from 'joi';
import { FridgeItemSortBy } from '../models/interfaces/fridge.interface';

const createFridgeItem = {
  body: Joi.object({
    ingredientId: Joi.number().integer().required(),
    quantity: Joi.number().min(0).required(),
    dueDate: Joi.date().iso().required(),
    priority: Joi.string()
      .valid(...Object.values(Priority))
      .required()
  })
};

const updateFridgeItem = {
  params: Joi.object({
    itemId: Joi.number().integer().required()
  }),
  body: Joi.object({
    quantity: Joi.number().min(0).optional(),
    dueDate: Joi.date().iso().optional(),
    priority: Joi.string()
      .valid(...Object.values(Priority))
      .optional()
  })
    .min(1)
    .required()
};

const getFridgeItems = {
  query: Joi.object({
    keyword: Joi.string().trim().optional(),
    priority: Joi.string()
      .valid(...Object.values(Priority))
      .optional(),
    isExpired: Joi.boolean().optional(),
    sortBy: Joi.string()
      .valid(...Object.values(FridgeItemSortBy))
      .optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional()
  })
};

const getFridgeItemById = {
  params: Joi.object({
    itemId: Joi.number().integer().required()
  })
};

const deleteFridgeItem = getFridgeItemById;

const getFridgeTransactions = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional()
  })
};

export default {
  createFridgeItem,
  updateFridgeItem,
  getFridgeItems,
  getFridgeItemById,
  deleteFridgeItem,
  getFridgeTransactions
};
