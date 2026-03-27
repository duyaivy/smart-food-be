import redis from '../redis';

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
    console.warn('[cache] getCache error:', err);
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
    console.warn('[cache] setCache error:', err);
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
    console.warn('[cache] delCache error:', err);
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
    console.warn('[cache] invalidateByPrefix error:', err);
  }
};

export default { getCache, setCache, delCache, invalidateByPrefix };
