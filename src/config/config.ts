import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),

    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number()
      .default(30)
      .description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number()
      .default(30)
      .description('days after which refresh tokens expire'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which reset password token expires'),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which verify email token expires'),

    SERVER_URL: Joi.string().uri().required().description('backend base url'),
    CLIENT_URL: Joi.string().uri().optional().description('frontend base url'),

    EMAIL_ENABLED: Joi.boolean()
      .truthy('true')
      .falsy('false')
      .default(false)
      .description('enable email sending'),

    SMTP_HOST: Joi.when('EMAIL_ENABLED', {
      is: true,
      then: Joi.string().required().description('server that will send the emails'),
      otherwise: Joi.string().allow('').optional()
    }),
    SMTP_PORT: Joi.when('EMAIL_ENABLED', {
      is: true,
      then: Joi.number().required().description('port to connect to the email server'),
      otherwise: Joi.number().optional()
    }),
    SMTP_USERNAME: Joi.when('EMAIL_ENABLED', {
      is: true,
      then: Joi.string().required().description('username for email server'),
      otherwise: Joi.string().allow('').optional()
    }),
    SMTP_PASSWORD: Joi.when('EMAIL_ENABLED', {
      is: true,
      then: Joi.string().required().description('password for email server'),
      otherwise: Joi.string().allow('').optional()
    }),
    EMAIL_FROM: Joi.when('EMAIL_ENABLED', {
      is: true,
      then: Joi.string().required().description('the from field in the emails sent by the app'),
      otherwise: Joi.string().allow('').optional()
    }),

    CLOUDINARY_CLOUD_NAME: Joi.string().required().description('Cloudinary cloud name'),
    CLOUDINARY_API_KEY: Joi.string().required().description('Cloudinary API key'),
    CLOUDINARY_API_SECRET: Joi.string().required().description('Cloudinary API secret'),
    CLOUDINARY_UPLOAD_PREDICT: Joi.boolean()
      .truthy('true')
      .falsy('false')
      .default(false)
      .description('enable upload scan/predict images to Cloudinary'),

    AI_MODEL_FILE_PATH: Joi.string().description('relative or absolute path to ONNX model file'),
    AI_MODEL_DATA_FILE_PATH: Joi.string().description(
      'relative or absolute path to ONNX external data file'
    ),
    AI_LABELS_FILE_PATH: Joi.string().description('relative or absolute path to labels json file'),
    RECOMMENDATION_SYSTEM_URL: Joi.string()
      .uri()
      .default('http://localhost:5000/predict')
      .description('external recommendation API endpoint'),
    RECOMMENDATION_API_TIMEOUT_MS: Joi.number()
      .default(90000)
      .description('per-attempt timeout for the external recommendation API call'),
    USE_MOCK_DATA: Joi.boolean().default(true).description('use mock data for recommendations')
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export default {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  serverUrl: envVars.SERVER_URL,
  clientUrl: envVars.CLIENT_URL,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES
  },
  email: {
    enabled: envVars.EMAIL_ENABLED,
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD
      }
    },
    from: envVars.EMAIL_FROM
  },
  cloudinary: {
    cloudName: envVars.CLOUDINARY_CLOUD_NAME,
    apiKey: envVars.CLOUDINARY_API_KEY,
    apiSecret: envVars.CLOUDINARY_API_SECRET,
    uploadPredict: envVars.CLOUDINARY_UPLOAD_PREDICT
  },
  ingredientClassification: {
    modelFilePath: envVars.AI_MODEL_FILE_PATH,
    modelDataFilePath: envVars.AI_MODEL_DATA_FILE_PATH,
    labelsFilePath: envVars.AI_LABELS_FILE_PATH
  },
  recommendation: {
    url: envVars.RECOMMENDATION_SYSTEM_URL,
    apiTimeoutMs: envVars.RECOMMENDATION_API_TIMEOUT_MS,
    useMockData: envVars.USE_MOCK_DATA
  }
};
