import Joi from 'joi';
import { password } from './custom.validation';

const register = {
  body: Joi.object()
    .keys({
      name: Joi.string().trim().required().messages({
        'any.required': 'Tên là bắt buộc',
        'string.empty': 'Tên là bắt buộc'
      }),
      email: Joi.string().trim().email().required().messages({
        'any.required': 'Email là bắt buộc',
        'string.empty': 'Email là bắt buộc',
        'string.email': 'Email không đúng định dạng'
      }),
      password: Joi.string().required().custom(password).messages({
        'any.required': 'Mật khẩu là bắt buộc',
        'string.empty': 'Mật khẩu là bắt buộc'
      })
    })
    .unknown(true)
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().trim().required().messages({
      'any.required': 'Email là bắt buộc',
      'string.empty': 'Email là bắt buộc'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Mật khẩu là bắt buộc',
      'string.empty': 'Mật khẩu là bắt buộc'
    })
  })
};

const logout = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token là bắt buộc',
      'string.empty': 'Refresh token là bắt buộc'
    })
  })
};

const refreshTokens = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token là bắt buộc',
      'string.empty': 'Refresh token là bắt buộc'
    })
  })
};

const forgotPassword = {
  body: Joi.object().keys({
    email: Joi.string().email().required().messages({
      'any.required': 'Email là bắt buộc',
      'string.empty': 'Email là bắt buộc',
      'string.email': 'Email không đúng định dạng'
    })
  })
};

const resetPassword = {
  body: Joi.object().keys({
    token: Joi.string().required().messages({
      'any.required': 'Token là bắt buộc',
      'string.empty': 'Token là bắt buộc'
    }),
    password: Joi.string().required().custom(password).messages({
      'any.required': 'Mật khẩu là bắt buộc',
      'string.empty': 'Mật khẩu là bắt buộc'
    })
  })
};

const verifyEmail = {
  query: Joi.object().keys({
    token: Joi.string().required().messages({
      'any.required': 'Token là bắt buộc',
      'string.empty': 'Token là bắt buộc'
    })
  })
};

export default {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  verifyEmail
};
