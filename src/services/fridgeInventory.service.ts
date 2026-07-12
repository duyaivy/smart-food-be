import httpStatus from 'http-status';
import { FridgeTransactionType, Prisma } from '@prisma/client';
import ApiError from '../utils/apiError';
import { roundNutrition } from '../utils/calc';
import fridgeTransactionService from './fridgeTransaction.service';

export type FridgeItemForDeduction = {
  id: number;
  ingredientId: number;
  quantity: number;
};

export type FridgeContext = {
  fridgeId: number;
  fridgeItems: FridgeItemForDeduction[];
  availableQuantityByIngredientId: Map<number, number>;
};

const buildAvailableQuantityMap = (fridgeItems: FridgeItemForDeduction[]) =>
  fridgeItems.reduce((map, item) => {
    const currentQuantity = map.get(item.ingredientId) ?? 0;

    map.set(item.ingredientId, currentQuantity + item.quantity);

    return map;
  }, new Map<number, number>());

const getFridgeContext = async (
  tx: Prisma.TransactionClient,
  userId: number,
  ingredientIds: number[]
): Promise<FridgeContext> => {
  const fridge = await tx.fridge.findUnique({
    where: {
      userId
    }
  });

  if (!fridge) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Người dùng chưa có tủ lạnh');
  }

  const fridgeItems = await tx.fridgeItem.findMany({
    where: {
      fridgeId: fridge.id,
      ingredientId: {
        in: ingredientIds
      },
      deleteAt: null,
      quantity: {
        gt: 0
      }
    },
    select: {
      id: true,
      ingredientId: true,
      quantity: true
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
  });

  return {
    fridgeId: fridge.id,
    fridgeItems,
    availableQuantityByIngredientId: buildAvailableQuantityMap(fridgeItems)
  };
};

const deductFridgeItems = async (
  tx: Prisma.TransactionClient,
  fridgeId: number,
  fridgeItems: FridgeItemForDeduction[],
  usedQuantityByIngredientId: Map<number, number>,
  mealName: string
) => {
  if (usedQuantityByIngredientId.size === 0) {
    return;
  }

  for (const [ingredientId, usedQuantity] of usedQuantityByIngredientId.entries()) {
    let remainingQuantity = usedQuantity;

    const itemsOfIngredient = fridgeItems.filter((item) => item.ingredientId === ingredientId);

    const availableQuantity = itemsOfIngredient.reduce((total, item) => total + item.quantity, 0);

    if (availableQuantity < usedQuantity) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Nguyên liệu ${ingredientId} trong tủ lạnh không đủ để nấu món này`
      );
    }

    for (const item of itemsOfIngredient) {
      if (remainingQuantity <= 0) {
        break;
      }

      const deductedQuantity = Math.min(item.quantity, remainingQuantity);
      const newQuantity = roundNutrition(item.quantity - deductedQuantity);

      await tx.fridgeItem.update({
        where: {
          id: item.id
        },
        data: {
          quantity: newQuantity,
          ...(newQuantity <= 0 ? { deleteAt: new Date() } : {})
        }
      });

      remainingQuantity -= deductedQuantity;
    }
  }

  await fridgeTransactionService.createFridgeTransaction(
    fridgeId,
    FridgeTransactionType.COOK,
    mealName,
    tx
  );
};

export default {
  buildAvailableQuantityMap,
  getFridgeContext,
  deductFridgeItems
};
