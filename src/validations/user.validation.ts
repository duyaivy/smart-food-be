import { ActivityLevel, Role } from '@prisma/client';
import Joi from 'joi';
import { password } from './custom.validation';

const createUser = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    name: Joi.string().required(),
    role: Joi.string().required().valid(Role.USER, Role.ADMIN),
    avatar: Joi.string().allow(null, '').optional(),
    height: Joi.number().allow(null).optional(),
    weight: Joi.number().allow(null).optional(),
    sex: Joi.boolean().allow(null).optional(),
    birthday: Joi.date().allow(null).optional(),
    activityLevel: Joi.string()
      .valid(
        ActivityLevel.SEDENTARY,
        ActivityLevel.LIGHT,
        ActivityLevel.MODERATE,
        ActivityLevel.ACTIVE,
        ActivityLevel.VERY_ACTIVE
      )
      .optional()
  })
};

const updateMe = {
  body: Joi.object()
    .keys({
      name: Joi.string(),
      avatar: Joi.string().allow(null, '').optional(),
      height: Joi.number().allow(null).optional(),
      weight: Joi.number().allow(null).optional(),
      sex: Joi.boolean().allow(null).optional(),
      birthday: Joi.date().allow(null).optional(),
      password: Joi.string().custom(password),
      activityLevel: Joi.string()
        .valid(
          ActivityLevel.SEDENTARY,
          ActivityLevel.LIGHT,
          ActivityLevel.MODERATE,
          ActivityLevel.ACTIVE,
          ActivityLevel.VERY_ACTIVE
        )
        .optional()
    })
    .min(1)
};

const getUsers = {
  query: Joi.object().keys({
    name: Joi.string(),
    role: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer()
  })
};

const getUser = {
  params: Joi.object().keys({
    userId: Joi.number().integer()
  })
};

const updateUser = {
  params: Joi.object().keys({
    userId: Joi.number().integer()
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      name: Joi.string()
    })
    .min(1)
};

const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.number().integer()
  })
};
const createPushToken = {
  body: Joi.object().keys({
    token: Joi.string().required(),
    deviceName: Joi.string().required()
  })
};

const sendTestNotification = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    message: Joi.string().required(),
    data: Joi.object().optional()
  })
};
export default {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  updateMe,
  createPushToken,
  sendTestNotification
};
