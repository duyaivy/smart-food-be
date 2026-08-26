import Redis from 'ioredis';
import config from './config/config';
import logger from './config/logger';

interface CustomNodeJsGlobal extends Global {
  redis?: Redis;
}

declare const global: CustomNodeJsGlobal;

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  logger.warn('[redis] REDIS_URL not set -> redis disabled');
}

const redis =
  global.redis ||
  (REDIS_URL
    ? new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true
      })
    : undefined);

if (config.env === 'development' && redis) global.redis = redis;

redis?.on('connect', () => logger.info('[redis] connected'));
redis?.on('error', (err) => logger.error('[redis] error: %o', err));

export default redis;
