/**
 * Redis cache key prefixes and TTL configuration for Dish module
 */

// Key prefixes
export const DISH_LIST_PREFIX = 'dish:list:';
export const DISH_DETAIL_PREFIX = 'dish:detail:';

// TTL in seconds
export const DISH_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days
export const DISH_SYNC_TTL = 60 * 60 * 24 * 30; // 30 days
