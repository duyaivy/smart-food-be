import { Unit } from '@prisma/client';
import Joi from 'joi';
import { IngredientSortBy } from '../models/interfaces/ingredient.interface';

const createIngredient = {
  body: Joi.object({
    name: Joi.string().trim().required(),
    categoryId: Joi.number().integer().allow(null).optional(),
    description: Joi.string().trim().optional(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    protein: Joi.number().min(0).optional(),
    carb: Joi.number().min(0).optional(),
    fat: Joi.number().min(0).optional(),
    unit: Joi.string()
      .valid(...Object.values(Unit))
      .optional()
  })
};

const updateIngredient = createIngredient.body.min(1).required();

const getIngredients = {
  query: Joi.object({
    name: Joi.string().trim().optional(),
    categoryId: Joi.number().integer().optional(),
    sortBy: Joi.string()
      .valid(...Object.values(IngredientSortBy))
      .optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional()
  })
};
const getIngredientById = {
  params: Joi.object({
    ingredientId: Joi.number().integer().required()
  })
};
const syncIngredients = {
  query: Joi.object({
    lastSyncAt: Joi.date().optional()
  })
};
const deleteIngredient = getIngredientById;
export default {
  createIngredient,
  updateIngredient,
  getIngredients,
  getIngredientById,
  deleteIngredient,
  syncIngredients
};
