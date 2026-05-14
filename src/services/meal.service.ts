import httpStatus from 'http-status';
import { FridgeTransactionType, Prisma } from '@prisma/client';
import prisma from '../client';
import ApiError from '../utils/apiError';
import {
  MealHistorySortBy,
  MealListResult,
  CreateMealInput,
  GetMealHistoryFilter,
  GetMealHistoryOptions,
  MealIngredientInput
} from '../models/interfaces/meal.interface';

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
  mealType: true,
  note: true,
  dishId: true,
  customName: true,
  isCustom: true,
  tag: true,
  totalKcal: true,
  totalProtein: true,
  totalCarb: true,
  totalFat: true,
  createdAt: true
} satisfies Prisma.MealLogSelect;

const mealHistoryListSelect = {
  ...mealLogBaseSelect
} satisfies Prisma.MealLogSelect;

const mealHistoryDetailSelect = {
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

type MealHistoryListItem = Prisma.MealLogGetPayload<{
  select: typeof mealHistoryListSelect;
}>;

type MealHistoryDetail = Prisma.MealLogGetPayload<{
  select: typeof mealHistoryDetailSelect;
}>;

type IngredientNutritionSource = {
  protein: number | null;
  carb: number | null;
  fat: number | null;
};

type SnapshotInput = {
  ingredientId: number | null;
  ingredientName: string;
  amount: number;
  unit: string;
  gramsEquivalent: number;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
};

const roundNutrition = (value: number): number => Number(value.toFixed(2));

const calculateIngredientNutrition = (
  ingredient: IngredientNutritionSource | null,
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

const calculateTotalNutrition = (snapshots: SnapshotInput[]) => {
  const totalKcal = roundNutrition(snapshots.reduce((total, snapshot) => total + snapshot.kcal, 0));
  const totalProtein = roundNutrition(
    snapshots.reduce((total, snapshot) => total + snapshot.protein, 0)
  );
  const totalCarb = roundNutrition(snapshots.reduce((total, snapshot) => total + snapshot.carb, 0));
  const totalFat = roundNutrition(snapshots.reduce((total, snapshot) => total + snapshot.fat, 0));

  return {
    totalKcal,
    totalProtein,
    totalCarb,
    totalFat
  };
};

const getDishForMeal = async (dishId: number) => {
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

const getIngredientsByIds = async (ingredientIds: number[]) => {
  if (ingredientIds.length === 0) {
    return new Map<number, IngredientNutritionSource & { id: number; name: string }>();
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
  mealName: string
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
      note: `Đã ghi nhận bữa ăn "${mealName}"`
    }
  });
};

const createMealFromExistingDish = async (
  userId: number,
  payload: CreateMealInput
): Promise<MealHistoryDetail> => {
  const { dishId, mealType, note, missingIngredientIds = [] } = payload;

  if (!dishId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'dishId là bắt buộc');
  }

  const dish = await getDishForMeal(dishId);

  const dishIngredientIds = new Set(dish.ingredients.map((item) => item.ingredientId));
  const invalidMissingIngredientId = missingIngredientIds.find(
    (ingredientId) => !dishIngredientIds.has(ingredientId)
  );

  if (invalidMissingIngredientId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Nguyên liệu ${invalidMissingIngredientId} không thuộc món ăn này`
    );
  }

  const missingIngredientIdSet = new Set(missingIngredientIds);

  const usedIngredients = dish.ingredients.filter(
    (item) => !missingIngredientIdSet.has(item.ingredientId)
  );

  if (usedIngredients.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bữa ăn cần có ít nhất một nguyên liệu');
  }

  const snapshots: SnapshotInput[] = usedIngredients.map((dishIngredient) => {
    const nutrition = calculateIngredientNutrition(
      dishIngredient.ingredient,
      dishIngredient.gramsEquivalent
    );

    return {
      ingredientId: dishIngredient.ingredientId,
      ingredientName: dishIngredient.ingredient.name,
      amount: dishIngredient.amount,
      unit: dishIngredient.unit,
      gramsEquivalent: dishIngredient.gramsEquivalent,
      kcal: nutrition.kcal,
      protein: nutrition.protein,
      carb: nutrition.carb,
      fat: nutrition.fat
    };
  });

  const totals = calculateTotalNutrition(snapshots);

  const usedQuantityByIngredientId = usedIngredients.reduce((map, dishIngredient) => {
    const currentQuantity = map.get(dishIngredient.ingredientId) ?? 0;
    map.set(dishIngredient.ingredientId, currentQuantity + dishIngredient.gramsEquivalent);

    return map;
  }, new Map<number, number>());

  const mealLog = await prisma.mealLog.create({
    data: {
      userId,
      dishId: dish.id,
      isCustom: false,
      ...(mealType !== undefined ? { mealType } : {}),
      ...(note !== undefined ? { note } : {}),
      ...totals,
      snapshots: {
        create: snapshots
      }
    },
    select: mealHistoryDetailSelect
  });

  await deductFridgeItems(userId, usedQuantityByIngredientId, dish.name).catch(() => undefined);

  return mealLog;
};

const createCustomMeal = async (
  userId: number,
  payload: CreateMealInput
): Promise<MealHistoryDetail> => {
  const { customName, mealType, note, customIngredients = [] } = payload;

  if (!customName) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'customName là bắt buộc');
  }

  if (customIngredients.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Custom meal cần có ít nhất một nguyên liệu');
  }

  const ingredientIds = [
    ...new Set(customIngredients.map((ingredient) => ingredient.ingredientId))
  ];

  const ingredientMap = await getIngredientsByIds(ingredientIds);

  const snapshots: SnapshotInput[] = customIngredients.map((input) => {
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

  const totals = calculateTotalNutrition(snapshots);

  const usedQuantityByIngredientId = customIngredients.reduce(
    (map, ingredient: MealIngredientInput) => {
      const currentQuantity = map.get(ingredient.ingredientId) ?? 0;
      map.set(ingredient.ingredientId, currentQuantity + ingredient.gramsEquivalent);

      return map;
    },
    new Map<number, number>()
  );

  const mealLog = await prisma.mealLog.create({
    data: {
      userId,
      dishId: null,
      customName,
      isCustom: true,
      tag: '#custom',
      ...(mealType !== undefined ? { mealType } : {}),
      ...(note !== undefined ? { note } : {}),
      ...totals,
      snapshots: {
        create: snapshots
      }
    },
    select: mealHistoryDetailSelect
  });

  await deductFridgeItems(userId, usedQuantityByIngredientId, customName).catch(() => undefined);

  return mealLog;
};

const createMeal = async (userId: number, payload: CreateMealInput): Promise<MealHistoryDetail> => {
  if (payload.dishId) {
    return createMealFromExistingDish(userId, payload);
  }

  return createCustomMeal(userId, payload);
};

const getMealHistory = async (
  userId: number,
  filter: GetMealHistoryFilter,
  options: GetMealHistoryOptions
): Promise<MealListResult<MealHistoryListItem>> => {
  const {
    sortBy = MealHistorySortBy.CREATED_AT,
    sortOrder = 'desc',
    limit = 10,
    page = 1
  } = options;

  const orderByField = (() => {
    switch (sortBy) {
      case MealHistorySortBy.CREATED_AT:
      default:
        return 'createdAt';
    }
  })();

  const whereClause: Prisma.MealLogWhereInput = {
    userId,
    ...(filter.dishId ? { dishId: filter.dishId } : {}),
    ...(filter.fromDate || filter.toDate
      ? {
          createdAt: {
            ...(filter.fromDate ? { gte: filter.fromDate } : {}),
            ...(filter.toDate ? { lte: filter.toDate } : {})
          }
        }
      : {})
  };

  const [results, total] = await Promise.all([
    prisma.mealLog.findMany({
      where: whereClause,
      select: mealHistoryListSelect,
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

const getMealHistoryById = async (
  userId: number,
  mealLogId: number
): Promise<MealHistoryDetail> => {
  const mealLog = await prisma.mealLog.findFirst({
    where: {
      id: mealLogId,
      userId
    },
    select: mealHistoryDetailSelect
  });

  if (!mealLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Lịch sử bữa ăn không tồn tại');
  }

  return mealLog;
};

export default {
  createMeal,
  getMealHistory,
  getMealHistoryById
};
