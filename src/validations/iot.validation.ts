import Joi from 'joi';

const uploadScan = {
  body: Joi.object().keys({
    weight: Joi.number().positive().required().messages({
      'any.required': 'Cân nặng là bắt buộc',
      'number.base': 'Cân nặng phải là số',
      'number.positive': 'Cân nặng phải lớn hơn 0'
    }),
    deviceUid: Joi.string().trim().required().messages({
      'any.required': 'Mã thiết bị là bắt buộc',
      'string.empty': 'Mã thiết bị không được để trống'
    }),
    scanId: Joi.string().trim().optional()
  })
};

const pairDevice = {
  body: Joi.object().keys({
    deviceUid: Joi.string().trim().required().messages({
      'any.required': 'Mã thiết bị là bắt buộc',
      'string.empty': 'Mã thiết bị không được để trống'
    }),
    apiKey: Joi.string().trim().required().messages({
      'any.required': 'Mã xác thực thiết bị là bắt buộc',
      'string.empty': 'Mã xác thực thiết bị không được để trống'
    })
  })
};

const getDeviceStatus = {
  params: Joi.object().keys({
    deviceUid: Joi.string().trim().required().messages({
      'any.required': 'Mã thiết bị là bắt buộc',
      'string.empty': 'Mã thiết bị không được để trống'
    })
  })
};

const unpairDevice = {
  params: Joi.object().keys({
    deviceUid: Joi.string().trim().required().messages({
      'any.required': 'Mã thiết bị là bắt buộc',
      'string.empty': 'Mã thiết bị không được để trống'
    })
  })
};

export default {
  uploadScan,
  pairDevice,
  getDeviceStatus,
  unpairDevice
};
