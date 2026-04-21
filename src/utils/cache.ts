import redis from '../redis';
import logger from '../config/logger';

/**
 * Get cached data by key.
 * Returns parsed JSON or null if cache miss / Redis unavailable.
 */
const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    if (!redis) return null;
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (err) {
    logger.warn('[cache] getCache error: %o', err);
    return null;
  }
};

/**
 * Set cache with optional TTL (in seconds).
 * Silently fails if Redis is unavailable.
 */
const setCache = async (key: string, data: unknown, ttl: number): Promise<void> => {
  try {
    if (!redis) return;
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (err) {
    logger.warn('[cache] setCache error: %o', err);
  }
};

/**
 * Delete a single cache key.
 * Silently fails if Redis is unavailable.
 */
const delCache = async (key: string): Promise<void> => {
  try {
    if (!redis) return;
    await redis.del(key);
  } catch (err) {
    logger.warn('[cache] delCache error: %o', err);
  }
};

/**
 * Invalidate all keys matching a given prefix using SCAN (production-safe).
 * Silently fails if Redis is unavailable.
 */
const invalidateByPrefix = async (prefix: string): Promise<void> => {
  try {
    if (!redis) return;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('[cache] invalidateByPrefix error: %o', err);
  }
};

export const buildListCacheKey = (
  filter: Record<string, unknown>,
  options: Record<string, unknown>,
  prefix: string
): string => {
  const params = { ...filter, ...options };
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);
  return `${prefix}${JSON.stringify(sorted)}`;
};

export default { getCache, setCache, delCache, invalidateByPrefix, buildListCacheKey };
