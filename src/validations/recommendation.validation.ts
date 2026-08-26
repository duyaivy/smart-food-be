import Joi from 'joi';
import { DishType, MealType } from '@prisma/client';

const createRecommendationJob = {
  body: Joi.object().keys({
    planDays: Joi.number().integer().min(1).max(30).required(),
    startDate: Joi.string().isoDate().required(),
    mealStructure: Joi.object({
      breakfast: Joi.object({
        mainDish: Joi.number().integer().min(0).default(0),
        soup: Joi.number().integer().min(0).default(0),
        vegetable: Joi.number().integer().min(0).default(0)
      }).optional(),
      lunch: Joi.object({
        mainDish: Joi.number().integer().min(0).default(0),
        soup: Joi.number().integer().min(0).default(0),
        vegetable: Joi.number().integer().min(0).default(0)
      }).optional(),
      dinner: Joi.object({
        mainDish: Joi.number().integer().min(0).default(0),
        soup: Joi.number().integer().min(0).default(0),
        vegetable: Joi.number().integer().min(0).default(0)
      }).optional()
    }).required(),
    goal: Joi.object({
      targetKg: Joi.number().required()
    }).required(),
    lockedPicks: Joi.array()
      .items(
        Joi.object({
          day: Joi.number().integer().min(1).required(),
          meal: Joi.string()
            .valid(...Object.values(MealType))
            .required(),
          role: Joi.string()
            .valid(...Object.values(DishType))
            .required(),
          dishId: Joi.number().integer().min(1).required()
        })
      )
      .optional()
  })
};

const getRecommendationJob = {
  params: Joi.object().keys({
    jobId: Joi.number().integer().positive().required()
  })
};

const getSubRecommendation = {
  body: Joi.object().keys({
    jobId: Joi.number().integer().positive().required(),
    dishIds: Joi.array().items(Joi.number().integer().positive()).min(1).required()
  })
};

const updateRecommendation = {
  params: Joi.object().keys({
    jobId: Joi.number().integer().positive().required()
  }),
  body: Joi.object().keys({
    day: Joi.number().integer().min(1).required(),
    meal: Joi.string()
      .valid(...Object.values(MealType))
      .required(),
    swaps: Joi.array()
      .items(
        Joi.object().keys({
          originalDishId: Joi.number().integer().positive().required(),
          dishId: Joi.number().integer().positive().required(),
          role: Joi.string().required(),
          name: Joi.string().optional(),
          calories: Joi.number().optional(),
          images: Joi.array().items(Joi.string()).optional(),
          missingIngredient: Joi.array()
            .items(
              Joi.object().keys({
                ingredientId: Joi.number().integer().positive().required(),
                unit: Joi.string().required(),
                quantity: Joi.number().min(0).required()
              })
            )
            .required()
        })
      )
      .min(1)
      .required()
  })
};

export default {
  createRecommendationJob,
  getRecommendationJob,
  getSubRecommendation,
  updateRecommendation
};
