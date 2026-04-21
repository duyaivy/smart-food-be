import prisma from '../client';
import { Prisma } from '@prisma/client';
import cache, { buildListCacheKey } from '../utils/cache';
import {
  INGREDIENT_LIST_PREFIX,
  INGREDIENT_DETAIL_PREFIX,
  INGREDIENT_CACHE_TTL,
  INGREDIENT_SYNC_TTL
} from '../constants/cache.constants';
import {
  CreateIngredientInput,
  IIngredient,
  IngredientListResult
} from '../models/interfaces/ingredient.interface';

/**
 * Build a deterministic cache key for ingredient list queries.
 * Sorts params alphabetically so identical queries always produce the same key.
 */

const invalidateIngredientCaches = async (ingredientId?: number): Promise<void> => {
  await cache.invalidateByPrefix(INGREDIENT_LIST_PREFIX);
  if (ingredientId !== undefined) {
    await cache.delCache(`${INGREDIENT_DETAIL_PREFIX}${ingredientId}`);
  }
};

const createIngredient = async (ingredient: CreateIngredientInput): Promise<IIngredient> => {
  const { name, images, unit, carb, categoryId, fat, protein, description } = ingredient;
  const created = await prisma.ingredient.create({
    data: {
      name,
      description,
      images,
      unit,
      carb,
      categoryId,
      fat,
      protein
    }
  });
  await invalidateIngredientCaches();
  return created;
};

const updateIngredient = async (
  ingredientId: number,
  updateData: Partial<CreateIngredientInput>
): Promise<IIngredient> => {
  const { name, images, unit, carb, categoryId, fat, protein, description } = updateData;
  const updated = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(images !== undefined ? { images } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(carb !== undefined ? { carb } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(fat !== undefined ? { fat } : {}),
      ...(protein !== undefined ? { protein } : {})
    }
  });
  await invalidateIngredientCaches(ingredientId);
  return updated;
};

const getIngredients = async (
  filter: { name?: string; categoryId?: number },
  options: { sortBy?: string; limit?: number; page?: number }
): Promise<IngredientListResult> => {
  const cacheKey = buildListCacheKey(filter, options, INGREDIENT_LIST_PREFIX);

  // Try cache first
  const cached = await cache.getCache<IngredientListResult>(cacheKey);
  if (cached) return cached;

  const { name, categoryId } = filter;
  const { sortBy = 'id', limit = 10, page = 1 } = options;
  const whereClause: Prisma.IngredientWhereInput = {
    isDeleted: false,
    ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
    ...(categoryId ? { categoryId } : {})
  };
  const ingredients = await prisma.ingredient.findMany({
    where: whereClause,
    orderBy: [{ [sortBy]: 'asc' }],
    skip: (page - 1) * limit,
    take: limit
  });
  const total = await prisma.ingredient.count({ where: whereClause });
  const control = {
    total,
    page,
    limit
  };
  const result = {
    control,
    results: ingredients
  };

  // Store in cache
  await cache.setCache(cacheKey, result, INGREDIENT_CACHE_TTL);

  return result;
};

const getIngredientById = async (ingredientId: number): Promise<IIngredient | null> => {
  const cacheKey = `${INGREDIENT_DETAIL_PREFIX}${ingredientId}`;

  // Try cache first
  const cached = await cache.getCache<IIngredient>(cacheKey);
  if (cached) return cached;

  const ingredient = await prisma.ingredient.findFirst({
    where: { id: ingredientId }
  });

  if (ingredient) {
    await cache.setCache(cacheKey, ingredient, INGREDIENT_CACHE_TTL);
  }

  return ingredient;
};

const deleteIngredient = async (ingredientId: number): Promise<IIngredient> => {
  const deleted = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: { isDeleted: true }
  });
  await invalidateIngredientCaches(ingredientId);
  return deleted;
};
const syncIngredients = async (lastSyncAt?: Date): Promise<IIngredient[]> => {
  const cacheKey = `${INGREDIENT_LIST_PREFIX}sync:${
    lastSyncAt ? lastSyncAt.toISOString().slice(0, 10) : 'unknown'
  }`;
  const cached = await cache.getCache<IIngredient[]>(cacheKey);

  if (cached) return cached;
  const whereClause: Prisma.IngredientWhereInput = {};
  if (lastSyncAt) {
    whereClause.updatedAt = { gte: lastSyncAt };
  }
  const ingredients = await prisma.ingredient.findMany({
    where: whereClause,
    orderBy: [{ id: 'asc' }]
  });

  if (ingredients.length > 0) {
    await cache.setCache(cacheKey, ingredients, INGREDIENT_SYNC_TTL);
  }
  return ingredients;
};

export default {
  createIngredient,
  updateIngredient,
  getIngredients,
  getIngredientById,
  deleteIngredient,
  syncIngredients
};
