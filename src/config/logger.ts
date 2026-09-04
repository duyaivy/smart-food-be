import winston from 'winston';
import config from './config';

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    enumerateErrorFormat(),
    config.env === 'development' ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.metadata({ fillExcept: ['level', 'message'] }),
    winston.format.printf(({ level, message, metadata }) => {
      const hasMetadata = metadata && Object.keys(metadata).length > 0;
      return hasMetadata
        ? `${level}: ${message} ${JSON.stringify(metadata)}`
        : `${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error']
    })
  ]
});

export default logger;
