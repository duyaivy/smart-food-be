import Joi from 'joi';

export const password: Joi.CustomValidator<string> = (value, helpers) => {
  if (value.length < 8) {
    return helpers.message({ custom: 'Mật khẩu phải có ít nhất 8 ký tự' });
  }

  if (!/\d/.test(value) || !/[a-zA-Z]/.test(value)) {
    return helpers.message({ custom: 'Mật khẩu phải chứa ít nhất 1 chữ cái và 1 chữ số' });
  }

  return value;
};
