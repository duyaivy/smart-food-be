import logger from '../config/logger';
import cache from '../utils/cache';
import notificationService from './notification.service';
import {
  DISH_DETAIL_PREFIX,
  DISH_LIST_PREFIX,
  INGREDIENT_DETAIL_PREFIX,
  INGREDIENT_LIST_PREFIX
} from '../constants/cache.constants';

const CACHE_PREFIXES = [
  DISH_LIST_PREFIX,
  DISH_DETAIL_PREFIX,
  INGREDIENT_LIST_PREFIX,
  INGREDIENT_DETAIL_PREFIX,
  'recommendation:job:',
  'iot:device:status:'
];

const clearApplicationCache = async (): Promise<void> => {
  await Promise.all(CACHE_PREFIXES.map((prefix) => cache.invalidateByPrefix(prefix)));

  logger.info('[SystemService] Cleared application cache by known prefixes', {
    prefixes: CACHE_PREFIXES
  });
};

const sendTestNotification = async (
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> => {
  await notificationService.sendNotificationToAllUsers(title, message, data);
};

export default {
  clearApplicationCache,
  sendTestNotification
};
