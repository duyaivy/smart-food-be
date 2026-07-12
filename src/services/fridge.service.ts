import httpStatus from 'http-status';
import { Prisma, FridgeTransactionType } from '@prisma/client';
import prisma from '../client';
import ApiError from '../utils/apiError';
import fridgeItemQuery from './fridgeItemQuery.service';
import fridgeTransactionService from './fridgeTransaction.service';
import {
  CreateFridgeItemInput,
  UpdateFridgeItemInput,
  GetFridgeItemsFilter,
  GetFridgeItemsOptions,
  GetFridgeTransactionsOptions,
  FridgeItemListResult,
  FridgeTransactionListResult
} from '../models/interfaces/fridge.interface';

type FridgeItemWithIngredient = Prisma.FridgeItemGetPayload<{
  include: {
    ingredient: true;
  };
}>;

const getOrCreateUserFridge = async (userId: number) => {
  return prisma.fridge.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      name: 'My Fridge'
    }
  });
};

const getUserFridge = async (userId: number) => {
  const fridge = await prisma.fridge.findUnique({
    where: { userId }
  });

  if (!fridge) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tủ lạnh của người dùng không tồn tại');
  }

  return fridge;
};

const validateIngredientExists = async (ingredientId: number) => {
  const ingredient = await prisma.ingredient.findFirst({
    where: {
      id: ingredientId,
      isDeleted: false
    }
  });

  if (!ingredient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Nguyên liệu không tồn tại');
  }

  return ingredient;
};

const getActiveFridgeItemByUser = async (
  userId: number,
  itemId: number
): Promise<FridgeItemWithIngredient> => {
  const item = await prisma.fridgeItem.findFirst({
    where: {
      id: itemId,
      deleteAt: null,
      fridge: {
        userId
      }
    },
    include: {
      ingredient: true
    }
  });

  if (!item) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Nguyên liệu trong tủ lạnh không tồn tại');
  }

  return item;
};

const createFridgeItem = async (
  userId: number,
  payload: CreateFridgeItemInput
): Promise<FridgeItemWithIngredient> => {
  const { ingredientId, quantity, dueDate, priority } = payload;

  await validateIngredientExists(ingredientId);
  const fridge = await getOrCreateUserFridge(userId);

  return prisma.$transaction(async (tx) => {
    const createdItem = await tx.fridgeItem.create({
      data: {
        fridgeId: fridge.id,
        ingredientId,
        quantity,
        dueDate: new Date(dueDate),
        priority
      },
      include: {
        ingredient: true
      }
    });

    await fridgeTransactionService.createFridgeTransaction(
      fridge.id,
      FridgeTransactionType.ADD,
      createdItem.ingredient.name,
      tx
    );

    return createdItem;
  });
};

const getFridgeItems = async (
  userId: number,
  filter: GetFridgeItemsFilter,
  options: GetFridgeItemsOptions
): Promise<FridgeItemListResult> => {
  const fridge = await getUserFridge(userId);
  const { limit, page } = fridgeItemQuery.normalizePagination(options);
  const whereClause = fridgeItemQuery.buildFridgeItemWhere(fridge.id, filter, new Date());
  const orderBy = fridgeItemQuery.buildFridgeItemOrderBy(options.sortBy, options.sortOrder);

  const [results, total] = await Promise.all([
    prisma.fridgeItem.findMany({
      where: whereClause,
      select: {
        id: true,
        fridgeId: true,
        ingredientId: true,
        dueDate: true,
        priority: true,
        quantity: true,
        deleteAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.fridgeItem.count({ where: whereClause })
  ]);

  return {
    control: { total, page, limit },
    results
  };
};

const getFridgeItemById = async (
  userId: number,
  itemId: number
): Promise<FridgeItemWithIngredient> => {
  return getActiveFridgeItemByUser(userId, itemId);
};

const updateFridgeItem = async (
  userId: number,
  itemId: number,
  payload: UpdateFridgeItemInput
): Promise<FridgeItemWithIngredient> => {
  const existingItem = await getActiveFridgeItemByUser(userId, itemId);

  const data: Prisma.FridgeItemUpdateInput = {
    ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
    ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
    ...(payload.dueDate !== undefined ? { dueDate: new Date(payload.dueDate) } : {})
  };

  return prisma.$transaction(async (tx) => {
    const updatedItem = await tx.fridgeItem.update({
      where: { id: existingItem.id },
      data,
      include: {
        ingredient: true
      }
    });

    await fridgeTransactionService.createFridgeTransaction(
      existingItem.fridgeId,
      FridgeTransactionType.ADJUST,
      updatedItem.ingredient.name,
      tx
    );

    return updatedItem;
  });
};

const deleteFridgeItem = async (
  userId: number,
  itemId: number
): Promise<FridgeItemWithIngredient> => {
  const existingItem = await getActiveFridgeItemByUser(userId, itemId);

  return prisma.$transaction(async (tx) => {
    const deletedItem = await tx.fridgeItem.update({
      where: { id: existingItem.id },
      data: {
        deleteAt: new Date()
      },
      include: {
        ingredient: true
      }
    });

    await fridgeTransactionService.createFridgeTransaction(
      existingItem.fridgeId,
      FridgeTransactionType.DISCARD,
      deletedItem.ingredient.name,
      tx
    );

    return deletedItem;
  });
};

const getFridgeTransactions = async (
  userId: number,
  options: GetFridgeTransactionsOptions
): Promise<FridgeTransactionListResult> => {
  const fridge = await getUserFridge(userId);
  const { limit, page } = fridgeItemQuery.normalizePagination(options, 20);

  const whereClause: Prisma.FridgeTransactionWhereInput = {
    fridgeId: fridge.id
  };

  const [results, total] = await Promise.all([
    prisma.fridgeTransaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.fridgeTransaction.count({ where: whereClause })
  ]);

  return {
    control: { total, page, limit },
    results
  };
};

export default {
  getOrCreateUserFridge,
  getUserFridge,
  createFridgeItem,
  getFridgeItems,
  getFridgeItemById,
  updateFridgeItem,
  deleteFridgeItem,
  getFridgeTransactions
};
