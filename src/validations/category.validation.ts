import Joi from 'joi';

const createCategory = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().optional().allow('')
  })
};

const updateCategory = {
  params: Joi.object().keys({
    id: Joi.number().required()
  }),
  body: Joi.object()
    .keys({
      name: Joi.string().optional(),
      description: Joi.string().optional().allow('')
    })
    .min(1)
};

const getDetailCategory = {
  params: Joi.object().keys({
    id: Joi.number().required()
  })
};

export default { createCategory, updateCategory, getDetailCategory };
