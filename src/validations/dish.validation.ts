import Joi from 'joi';
import { Difficulty, DishSortBy } from '../interfaces/dish.interface';

const instructionItemSchema = Joi.object({
  title: Joi.string().allow('').optional(),
  content: Joi.string().trim().required()
});

const createDish = {
  body: Joi.object({
    name: Joi.string().trim().required(),
    instructions: Joi.array().items(instructionItemSchema).optional(),
    description: Joi.string().trim().optional(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    prepTimeMin: Joi.number().integer().min(0).optional(),
    cookTimeMin: Joi.number().integer().min(0).optional(),
    difficulty: Joi.string()
      .valid(...Object.values(Difficulty))
      .required()
  })
};

const updateDish = {
  body: Joi.object({
    name: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
    instructions: Joi.array().items(instructionItemSchema).optional(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    prepTimeMin: Joi.number().integer().min(0).optional(),
    cookTimeMin: Joi.number().integer().min(0).optional(),
    difficulty: Joi.string()
      .valid(...Object.values(Difficulty))
      .optional()
  }).min(1)
};
const getDishes = {
  query: Joi.object({
    name: Joi.string().trim().optional(),
    difficulty: Joi.string()
      .valid(...Object.values(Difficulty))
      .optional(),
    sortBy: Joi.string()
      .valid(...Object.values(DishSortBy))
      .optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).optional()
  })
};
const getDishById = {
  params: Joi.object({
    dishId: Joi.number().integer().required()
  })
};
const deleteDish = getDishById;
export default {
  createDish,
  updateDish,
  getDishes,
  getDishById,
  deleteDish
};
