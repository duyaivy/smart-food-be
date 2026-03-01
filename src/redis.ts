import Redis from 'ioredis';
import config from './config/config';

interface CustomNodeJsGlobal extends Global {
  redis?: Redis;
}

declare const global: CustomNodeJsGlobal;

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.warn('[redis] REDIS_URL not set -> redis disabled');
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

redis?.on('connect', () => console.log('[redis] connected'));
redis?.on('error', (err) => console.error('[redis] error', err));

export default redis;
