import Joi from 'joi';

const dateQuerySchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'date phải có định dạng YYYY-MM-DD',
      'any.required': 'date là bắt buộc'
    })
});

const getDailyNutrition = {
  query: dateQuerySchema
};

const getDailyRemainingNutrition = {
  query: dateQuerySchema
};

const getWeeklyNutrition = {
  query: Joi.object({
    week: Joi.string()
      .pattern(/^\d{4}-W\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'week phải có định dạng YYYY-WW',
        'any.required': 'week là bắt buộc'
      })
  })
};

export default {
  getDailyNutrition,
  getWeeklyNutrition,
  getDailyRemainingNutrition
};
