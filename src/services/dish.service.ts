import prisma from '../client';
import { CreateDishInput, Difficulty } from '../interfaces/dish.interface';
import { Dish, Prisma } from '@prisma/client';
import cache from '../utils/cache';
import { DISH_LIST_PREFIX, DISH_DETAIL_PREFIX, DISH_CACHE_TTL } from '../constants/cache.constants';

/** Explicit return type for getDishes to avoid circular type inference */
interface DishListResult {
  control: { total: number; page: number; limit: number };
  results: {
    id: number;
    name: string;
    prepTimeMin: number | null;
    cookTimeMin: number | null;
    description: string | null;
    difficulty: Difficulty;
    images: string[];
  }[];
}

/**
 * Build a deterministic cache key for dish list queries.
 * Sorts params alphabetically so identical queries always produce the same key.
 */
const buildListCacheKey = (
  filter: Record<string, unknown>,
  options: Record<string, unknown>
): string => {
  const params = { ...filter, ...options };
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);
  return `${DISH_LIST_PREFIX}${JSON.stringify(sorted)}`;
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
  return created;
};

const updateDish = async (dishId: number, updateData: Partial<CreateDishInput>): Promise<Dish> => {
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
  return updated;
};

const getDishes = async (
  filter: { name?: string; difficulty?: Difficulty },
  options: { sortBy?: string; limit?: number; page?: number }
): Promise<DishListResult> => {
  const cacheKey = buildListCacheKey(filter, options);

  // Try cache first
  const cached = await cache.getCache<DishListResult>(cacheKey);
  if (cached) return cached;

  const { name, difficulty } = filter;
  const { sortBy = 'createdAt', limit = 10, page = 1 } = options;
  const whereClause: Prisma.DishWhereInput = {
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
      images: true
    },
    orderBy: [{ [sortBy]: 'desc' }],
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

  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
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
  const deleted = await prisma.dish.delete({
    where: { id: dishId }
  });
  await invalidateDishCaches(dishId);
  return deleted;
};

export default {
  createDish,
  updateDish,
  getDishes,
  getDishById,
  deleteDish
};
