import Joi from 'joi';
import { MealType, Unit } from '@prisma/client';
import { MealHistorySortBy } from '../models/interfaces/meal.interface';

const mealIngredientSchema = Joi.object({
  ingredientId: Joi.number().integer().required(),
  amount: Joi.number().positive().required(),
  unit: Joi.string()
    .valid(...Object.values(Unit))
    .required(),
  gramsEquivalent: Joi.number().positive().required()
});

const createMeal = {
  body: Joi.object({
    dishId: Joi.number().integer().optional(),

    customName: Joi.string().trim().optional(),

    mealType: Joi.string()
      .valid(...Object.values(MealType))
      .optional(),

    note: Joi.string().trim().allow('').optional(),

    eatenAt: Joi.date().iso().optional(),

    missingIngredientIds: Joi.array().items(Joi.number().integer()).default([]),

    allowMissingIngredients: Joi.boolean().optional().default(false),

    customIngredients: Joi.array().items(mealIngredientSchema).optional()
  })
    .xor('dishId', 'customName')
    .custom((value, helpers) => {
      if (value.customName && (!value.customIngredients || value.customIngredients.length === 0)) {
        return helpers.message({
          custom: 'Bữa ăn tự tạo cần có danh sách nguyên liệu'
        });
      }

      if (value.dishId && value.customIngredients) {
        return helpers.message({
          custom: 'Bữa ăn từ món có sẵn không được gửi danh sách nguyên liệu tự tạo'
        });
      }

      if (value.customName && value.missingIngredientIds?.length > 0) {
        return helpers.message({
          custom: 'Bữa ăn tự tạo không được gửi danh sách nguyên liệu bị thiếu'
        });
      }

      return value;
    })
};

const getMealHistory = {
  query: Joi.object({
    dishId: Joi.number().integer().optional(),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    sortBy: Joi.string()
      .valid(...Object.values(MealHistorySortBy))
      .optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional()
  })
};

const getMealHistoryById = {
  params: Joi.object({
    mealLogId: Joi.number().integer().required()
  })
};

export default {
  createMeal,
  getMealHistory,
  getMealHistoryById
};
