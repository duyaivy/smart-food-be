import httpStatus from 'http-status';
import { FridgeTransactionType, Prisma } from '@prisma/client';
import prisma from '../client';
import ApiError from '../utils/apiError';
import {
  CookingHistorySortBy,
  CookingListResult,
  CreateCookingInput,
  GetCookingHistoryFilter,
  GetCookingHistoryOptions
} from '../models/interfaces/cooking.interface';

const dishSummarySelect = {
  id: true,
  name: true,
  images: true,
  prepTimeMin: true,
  cookTimeMin: true,
  calories: true,
  difficulty: true,
  type: true
} satisfies Prisma.DishSelect;

const mealLogBaseSelect = {
  id: true,
  userId: true,
  eatenAt: true,
  mealType: true,
  note: true,
  dishId: true,
  totalKcal: true,
  totalProtein: true,
  totalCarb: true,
  totalFat: true,
  createdAt: true
} satisfies Prisma.MealLogSelect;

const cookingHistoryListSelect = {
  ...mealLogBaseSelect,
  dish: {
    select: {
      id: true,
      name: true,
      images: true,
      calories: true,
      prepTimeMin: true,
      cookTimeMin: true
    }
  }
} satisfies Prisma.MealLogSelect;

const cookingHistoryDetailSelect = {
  ...mealLogBaseSelect,
  dish: {
    select: {
      id: true,
      name: true,
      images: true,
      prepTimeMin: true,
      cookTimeMin: true,
      calories: true,
      difficulty: true,
      description: true,
      instructions: true,
      type: true
    }
  },
  snapshots: {
    select: {
      id: true,
      mealLogId: true,
      ingredientId: true,
      ingredientName: true,
      amount: true,
      unit: true,
      gramsEquivalent: true,
      kcal: true,
      protein: true,
      carb: true,
      fat: true,
      createdAt: true
    }
  }
} satisfies Prisma.MealLogSelect;

type CookingHistoryListItem = Prisma.MealLogGetPayload<{
  select: typeof cookingHistoryListSelect;
}>;

type CookingHistoryDetail = Prisma.MealLogGetPayload<{
  select: typeof cookingHistoryDetailSelect;
}>;

const roundNutrition = (value: number): number => Number(value.toFixed(2));

const calculateIngredientNutrition = (
  ingredient: {
    protein: number | null;
    carb: number | null;
    fat: number | null;
  } | null,
  gramsEquivalent: number
) => {
  const ratio = gramsEquivalent / 100;

  const protein = roundNutrition((ingredient?.protein ?? 0) * ratio);
  const carb = roundNutrition((ingredient?.carb ?? 0) * ratio);
  const fat = roundNutrition((ingredient?.fat ?? 0) * ratio);
  const kcal = roundNutrition(protein * 4 + carb * 4 + fat * 9);

  return {
    kcal,
    protein,
    carb,
    fat
  };
};

const getDishForCooking = async (dishId: number) => {
  const dish = await prisma.dish.findFirst({
    where: {
      id: dishId,
      isDeleted: false
    },
    select: {
      ...dishSummarySelect,
      ingredients: {
        select: {
          id: true,
          dishId: true,
          ingredientId: true,
          amount: true,
          unit: true,
          gramsEquivalent: true,
          ingredient: {
            select: {
              id: true,
              name: true,
              images: true,
              unit: true,
              protein: true,
              carb: true,
              fat: true
            }
          }
        }
      }
    }
  });

  if (!dish) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Món ăn không tồn tại');
  }

  return dish;
};

const getCookingPreview = async (userId: number, dishId: number) => {
  const dish = await getDishForCooking(dishId);

  const fridgeItems = await prisma.fridgeItem.findMany({
    where: {
      deleteAt: null,
      fridge: {
        userId
      }
    },
    select: {
      ingredientId: true,
      quantity: true
    }
  });

  const availableQuantityByIngredientId = fridgeItems.reduce((map, item) => {
    const currentQuantity = map.get(item.ingredientId) ?? 0;
    map.set(item.ingredientId, currentQuantity + item.quantity);

    return map;
  }, new Map<number, number>());

  return {
    dish: {
      id: dish.id,
      name: dish.name,
      images: dish.images,
      prepTimeMin: dish.prepTimeMin,
      cookTimeMin: dish.cookTimeMin,
      calories: dish.calories,
      difficulty: dish.difficulty,
      type: dish.type
    },
    ingredients: dish.ingredients.map((dishIngredient) => {
      const availableQuantity =
        availableQuantityByIngredientId.get(dishIngredient.ingredientId) ?? 0;

      return {
        dishIngredientId: dishIngredient.id,
        ingredientId: dishIngredient.ingredientId,
        ingredientName: dishIngredient.ingredient.name,
        ingredientImages: dishIngredient.ingredient.images,
        recipeAmount: dishIngredient.amount,
        recipeUnit: dishIngredient.unit,
        recipeGramsEquivalent: dishIngredient.gramsEquivalent,
        availableQuantity,
        isEnough: availableQuantity >= dishIngredient.gramsEquivalent,
        nutritionPer100g: {
          protein: dishIngredient.ingredient.protein,
          carb: dishIngredient.ingredient.carb,
          fat: dishIngredient.ingredient.fat
        }
      };
    })
  };
};

const getIngredientsByIds = async (ingredientIds: number[]) => {
  if (ingredientIds.length === 0) {
    return new Map();
  }

  const ingredients = await prisma.ingredient.findMany({
    where: {
      id: {
        in: ingredientIds
      },
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      protein: true,
      carb: true,
      fat: true
    }
  });

  const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  const missingIngredientId = ingredientIds.find(
    (ingredientId) => !ingredientMap.has(ingredientId)
  );

  if (missingIngredientId) {
    throw new ApiError(httpStatus.NOT_FOUND, `Nguyên liệu ${missingIngredientId} không tồn tại`);
  }

  return ingredientMap;
};

const deductFridgeItems = async (
  userId: number,
  usedQuantityByIngredientId: Map<number, number>,
  dishName: string
) => {
  if (usedQuantityByIngredientId.size === 0) {
    return;
  }

  const fridge = await prisma.fridge.findUnique({
    where: {
      userId
    }
  });

  if (!fridge) {
    return;
  }

  for (const [ingredientId, usedQuantity] of usedQuantityByIngredientId.entries()) {
    let remainingQuantity = usedQuantity;

    const fridgeItems = await prisma.fridgeItem.findMany({
      where: {
        fridgeId: fridge.id,
        ingredientId,
        deleteAt: null,
        quantity: {
          gt: 0
        }
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
    });

    for (const item of fridgeItems) {
      if (remainingQuantity <= 0) {
        break;
      }

      const deductedQuantity = Math.min(item.quantity, remainingQuantity);
      const newQuantity = item.quantity - deductedQuantity;

      await prisma.fridgeItem.update({
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

  await prisma.fridgeTransaction.create({
    data: {
      fridgeId: fridge.id,
      type: FridgeTransactionType.COOK,
      note: `Đã nấu món "${dishName}"`
    }
  });
};

const createCooking = async (
  userId: number,
  payload: CreateCookingInput
): Promise<CookingHistoryDetail> => {
  const { dishId, eatenAt, mealType, note, ingredients } = payload;

  const dish = await prisma.dish.findFirst({
    where: {
      id: dishId,
      isDeleted: false
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!dish) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Món ăn không tồn tại');
  }

  const ingredientIds = ingredients.map((ingredient) => ingredient.ingredientId);
  const ingredientMap = await getIngredientsByIds([...new Set(ingredientIds)]);

  const snapshotData = ingredients.map((input) => {
    const ingredient = ingredientMap.get(input.ingredientId);

    if (!ingredient) {
      throw new ApiError(httpStatus.NOT_FOUND, `Nguyên liệu ${input.ingredientId} không tồn tại`);
    }

    const nutrition = calculateIngredientNutrition(ingredient, input.gramsEquivalent);

    return {
      ingredientId: input.ingredientId,
      ingredientName: ingredient.name,
      amount: input.amount,
      unit: input.unit,
      gramsEquivalent: input.gramsEquivalent,
      kcal: nutrition.kcal,
      protein: nutrition.protein,
      carb: nutrition.carb,
      fat: nutrition.fat
    };
  });

  const totalKcal = roundNutrition(
    snapshotData.reduce((total, snapshot) => total + (snapshot.kcal ?? 0), 0)
  );
  const totalProtein = roundNutrition(
    snapshotData.reduce((total, snapshot) => total + (snapshot.protein ?? 0), 0)
  );
  const totalCarb = roundNutrition(
    snapshotData.reduce((total, snapshot) => total + (snapshot.carb ?? 0), 0)
  );
  const totalFat = roundNutrition(
    snapshotData.reduce((total, snapshot) => total + (snapshot.fat ?? 0), 0)
  );

  const usedQuantityByIngredientId = ingredients.reduce((map, ingredient) => {
    const currentQuantity = map.get(ingredient.ingredientId) ?? 0;
    map.set(ingredient.ingredientId, currentQuantity + ingredient.gramsEquivalent);

    return map;
  }, new Map<number, number>());

  const mealLog = await prisma.mealLog.create({
    data: {
      userId,
      dishId,
      eatenAt: new Date(eatenAt),
      ...(mealType !== undefined ? { mealType } : {}),
      ...(note !== undefined ? { note } : {}),
      totalKcal,
      totalProtein,
      totalCarb,
      totalFat,
      snapshots: {
        create: snapshotData
      }
    },
    select: cookingHistoryDetailSelect
  });

  await deductFridgeItems(userId, usedQuantityByIngredientId, dish.name).catch(() => undefined);

  return mealLog;
};

const getCookingHistory = async (
  userId: number,
  filter: GetCookingHistoryFilter,
  options: GetCookingHistoryOptions
): Promise<CookingListResult<CookingHistoryListItem>> => {
  const {
    sortBy = CookingHistorySortBy.CREATED_AT,
    sortOrder = 'desc',
    limit = 10,
    page = 1
  } = options;

  const orderByField = (() => {
    switch (sortBy) {
      case CookingHistorySortBy.CREATED_AT:
        return 'createdAt';
      case CookingHistorySortBy.EATEN_AT:
      default:
        return 'eatenAt';
    }
  })();

  const whereClause: Prisma.MealLogWhereInput = {
    userId,
    dishId: {
      not: null
    },
    ...(filter.dishId ? { dishId: filter.dishId } : {}),
    ...(filter.fromDate || filter.toDate
      ? {
          eatenAt: {
            ...(filter.fromDate ? { gte: filter.fromDate } : {}),
            ...(filter.toDate ? { lte: filter.toDate } : {})
          }
        }
      : {})
  };

  const [results, total] = await Promise.all([
    prisma.mealLog.findMany({
      where: whereClause,
      select: cookingHistoryListSelect,
      orderBy: [
        {
          [orderByField]: sortOrder
        },
        {
          id: 'desc'
        }
      ],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.mealLog.count({
      where: whereClause
    })
  ]);

  return {
    control: {
      total,
      page,
      limit
    },
    results
  };
};

const getCookingHistoryById = async (
  userId: number,
  mealLogId: number
): Promise<CookingHistoryDetail> => {
  const mealLog = await prisma.mealLog.findFirst({
    where: {
      id: mealLogId,
      userId,
      dishId: {
        not: null
      }
    },
    select: cookingHistoryDetailSelect
  });

  if (!mealLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Lịch sử nấu ăn không tồn tại');
  }

  return mealLog;
};

export default {
  getCookingPreview,
  createCooking,
  getCookingHistory,
  getCookingHistoryById
};
