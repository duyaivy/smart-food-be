import prisma from '../client';
import {
  CreateDishInput,
  Difficulty,
  DishListResult,
  DishSortBy,
  MiniDish
} from '../models/interfaces/dish.interface';
import { Dish, Prisma } from '@prisma/client';
import cache, { buildListCacheKey } from '../utils/cache';
import ApiError from '../utils/apiError';
import httpStatus from 'http-status';
import dishNotificationService from './dishNotification.service';
import {
  DISH_LIST_PREFIX,
  DISH_DETAIL_PREFIX,
  DISH_CACHE_TTL,
  DISH_SYNC_TTL
} from '../constants/cache.constants';

const dishSortFieldMap: Record<DishSortBy, Prisma.DishScalarFieldEnum> = {
  [DishSortBy.NAME]: Prisma.DishScalarFieldEnum.name,
  [DishSortBy.PREP_TIME]: Prisma.DishScalarFieldEnum.prepTimeMin,
  [DishSortBy.COOK_TIME]: Prisma.DishScalarFieldEnum.cookTimeMin,
  [DishSortBy.CREATED_AT]: Prisma.DishScalarFieldEnum.createdAt
};

/**
 * Invalidate all dish-related caches (list caches + optionally a specific detail cache).
 */
const invalidateDishCaches = async (dishId?: number): Promise<void> => {
  await cache.invalidateByPrefix(DISH_LIST_PREFIX);
  if (dishId !== undefined) {
    await cache.delCache(`${DISH_DETAIL_PREFIX}${dishId}`);
  }
};

const ensureActiveDishExists = async (dishId: number): Promise<void> => {
  const dish = await prisma.dish.findFirst({
    where: { id: dishId, isDeleted: false },
    select: { id: true }
  });

  if (!dish) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Dish not found');
  }
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

const createDish = async (dish: CreateDishInput): Promise<Dish> => {
  const { prepTimeMin, cookTimeMin, difficulty, name, images, instructions, description } = dish;
  const created = await prisma.dish.create({
    data: {
      name,
      difficulty,
      ...(description !== undefined ? { description } : {}),
      ...(prepTimeMin !== undefined ? { prepTimeMin } : {}),
      ...(cookTimeMin !== undefined ? { cookTimeMin } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(instructions !== undefined
        ? { instructions: instructions as unknown as Prisma.InputJsonValue }
        : {})
    }
  });
  await invalidateDishCaches();
  dishNotificationService.notifyDishCreated(created);
  return created;
};

const updateDish = async (dishId: number, updateData: Partial<CreateDishInput>): Promise<Dish> => {
  await ensureActiveDishExists(dishId);

  const { prepTimeMin, cookTimeMin, difficulty, name, images, instructions, description } =
    updateData;
  const updated = await prisma.dish.update({
    where: { id: dishId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(difficulty !== undefined ? { difficulty } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(prepTimeMin !== undefined ? { prepTimeMin } : {}),
      ...(cookTimeMin !== undefined ? { cookTimeMin } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(instructions !== undefined
        ? { instructions: instructions as unknown as Prisma.InputJsonValue }
        : {})
    }
  });
  await invalidateDishCaches(dishId);
  dishNotificationService.notifyDishUpdated(dishId);
  return updated;
};

const getDishes = async (
  filter: { name?: string; difficulty?: Difficulty },
  options: { sortBy?: DishSortBy; limit?: number; page?: number }
): Promise<DishListResult> => {
  const cacheKey = buildListCacheKey(filter, options, DISH_LIST_PREFIX);

  // Try cache first
  const cached = await cache.getCache<DishListResult>(cacheKey);
  if (cached) return cached;

  const { name, difficulty } = filter;
  const { sortBy = 'id', limit = 10, page = 1 } = options;
  const whereClause: Prisma.DishWhereInput = {
    isDeleted: false,
    ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
    ...(difficulty ? { difficulty } : {})
  };
  const dishes = await prisma.dish.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      prepTimeMin: true,
      cookTimeMin: true,
      description: true,
      difficulty: true,
      images: true,
      calories: true
    },
    orderBy: [{ [sortBy === 'id' ? 'id' : dishSortFieldMap[sortBy]]: 'asc' }],
    skip: (page - 1) * limit,
    take: limit
  });
  const total = await prisma.dish.count({ where: whereClause });
  const control = {
    total,
    page,
    limit
  };
  const result = {
    control,
    results: dishes
  };

  // Store in cache
  await cache.setCache(cacheKey, result, DISH_CACHE_TTL);

  return result;
};

type DishWithIngredients = Prisma.DishGetPayload<{
  include: { ingredients: { include: { ingredient: true } } };
}>;

const getDishById = async (dishId: number): Promise<DishWithIngredients | null> => {
  const cacheKey = `${DISH_DETAIL_PREFIX}${dishId}`;

  // Try cache first
  const cached = await cache.getCache<DishWithIngredients>(cacheKey);
  if (cached) return cached;

  const dish = await prisma.dish.findFirst({
    where: { id: dishId, isDeleted: false },
    include: {
      ingredients: {
        include: {
          ingredient: true
        }
      }
    }
  });

  // Store in cache (only if found)
  if (dish) {
    await cache.setCache(cacheKey, dish, DISH_CACHE_TTL);
  }

  return dish;
};

const deleteDish = async (dishId: number): Promise<Dish> => {
  await ensureActiveDishExists(dishId);

  const deleted = await prisma.dish.update({
    where: { id: dishId },
    data: { isDeleted: true }
  });
  await invalidateDishCaches(dishId);
  dishNotificationService.notifyDishDeleted(dishId);
  return deleted;
};
const syncDishes = async (lastSyncAt?: Date): Promise<MiniDish[]> => {
  const cacheKey = `${DISH_LIST_PREFIX}sync:${
    lastSyncAt ? lastSyncAt.toISOString().slice(0, 10) : 'unknown'
  }`;
  const cached = await cache.getCache<MiniDish[]>(cacheKey);

  if (cached) return cached;
  const whereClause: Prisma.DishWhereInput = {};
  if (lastSyncAt) {
    whereClause.updatedAt = { gte: lastSyncAt };
  }
  const dishes = await prisma.dish.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      prepTimeMin: true,
      cookTimeMin: true,
      description: true,
      difficulty: true,
      images: true,
      calories: true
    },
    orderBy: [{ id: 'asc' }]
  });

  if (dishes.length > 0) {
    await cache.setCache(cacheKey, dishes, DISH_SYNC_TTL);
  }
  return dishes;
};

export default {
  createDish,
  updateDish,
  getDishes,
  getDishById,
  deleteDish,
  syncDishes
};
