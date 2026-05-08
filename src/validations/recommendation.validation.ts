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

export default { createRecommendationJob, getRecommendationJob };
