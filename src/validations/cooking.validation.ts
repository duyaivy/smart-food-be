import Joi from 'joi';
import { MealType, Unit } from '@prisma/client';
import { CookingHistorySortBy } from '../models/interfaces/cooking.interface';

const getCookingPreview = {
  params: Joi.object({
    dishId: Joi.number().integer().required()
  })
};

const cookingIngredientSchema = Joi.object({
  ingredientId: Joi.number().integer().required(),
  amount: Joi.number().min(0).required(),
  unit: Joi.string()
    .valid(...Object.values(Unit))
    .required(),
  gramsEquivalent: Joi.number().min(0).required()
});

const createCooking = {
  body: Joi.object({
    dishId: Joi.number().integer().required(),
    eatenAt: Joi.date().iso().required(),
    mealType: Joi.string()
      .valid(...Object.values(MealType))
      .optional(),
    note: Joi.string().trim().allow('').optional(),
    ingredients: Joi.array().items(cookingIngredientSchema).min(1).required()
  })
};

const getCookingHistory = {
  query: Joi.object({
    dishId: Joi.number().integer().optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    sortBy: Joi.string()
      .valid(...Object.values(CookingHistorySortBy))
      .optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional()
  })
};

const getCookingHistoryById = {
  params: Joi.object({
    mealLogId: Joi.number().integer().required()
  })
};

export default {
  getCookingPreview,
  createCooking,
  getCookingHistory,
  getCookingHistoryById
};
