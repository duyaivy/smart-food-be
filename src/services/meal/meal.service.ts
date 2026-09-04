import httpStatus from 'http-status';
import { Prisma } from '@prisma/client';
import prisma from '../../client';
import ApiError from '../../utils/apiError';
import fridgeInventoryService from '../fridge/fridgeInventory.service';
import {
  MealHistorySortBy,
  MealListResult,
  CreateMealInput,
  GetMealHistoryFilter,
  GetMealHistoryOptions,
  MealIngredientInput
} from '../../models/interfaces/meal.interface';
import {
  calculateIngredientNutrition,
  calculateTotalNutrition,
  roundNutrition,
  type IngredientNutritionSource
} from '../../utils/calc';

const transactionOptions = {
  maxWait: 20000,
  timeout: 60000
};

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
  eatenAt: true,
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

type NutritionIngredientInput = {
  ingredientId: number;
  ingredientName: string;
  amount: number;
  unit: string;
  gramsEquivalent: number;
  ingredient: IngredientNutritionSource;
};

type FridgeInventoryPort = Pick<
  typeof fridgeInventoryService,
  'getFridgeContext' | 'deductFridgeItems'
>;

const fridgeInventoryPort: FridgeInventoryPort = fridgeInventoryService;

type CreateMealLogAndDeductInput = {
  userId: number;
  ingredientIds: number[];
  nutritionIngredients: NutritionIngredientInput[];
  allowMissingIngredients: boolean;
  mealLogData: Prisma.MealLogUncheckedCreateWithoutSnapshotsInput;
  deductionName: string;
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

const buildSnapshotsByAvailableQuantity = (
  ingredients: NutritionIngredientInput[],
  availableQuantityByIngredientId: Map<number, number>,
  allowMissingIngredients: boolean
) => {
  const remainingQuantityByIngredientId = new Map(availableQuantityByIngredientId);
  const snapshots: SnapshotInput[] = [];
  const usedQuantityByIngredientId = new Map<number, number>();
  const insufficientMessages: string[] = [];

  for (const ingredientInput of ingredients) {
    const availableQuantity =
      remainingQuantityByIngredientId.get(ingredientInput.ingredientId) ?? 0;
    const requiredQuantity = ingredientInput.gramsEquivalent;

    if (availableQuantity < requiredQuantity && !allowMissingIngredients) {
      insufficientMessages.push(
        `${ingredientInput.ingredientName}: cần ${requiredQuantity}g, hiện có ${availableQuantity}g`
      );
      continue;
    }

    const actualUsedQuantity = allowMissingIngredients
      ? Math.min(requiredQuantity, availableQuantity)
      : requiredQuantity;

    if (actualUsedQuantity <= 0) {
      continue;
    }

    const amountRatio =
      ingredientInput.gramsEquivalent > 0
        ? actualUsedQuantity / ingredientInput.gramsEquivalent
        : 0;

    const actualAmount = roundNutrition(ingredientInput.amount * amountRatio);

    const nutrition = calculateIngredientNutrition(ingredientInput.ingredient, actualUsedQuantity);

    snapshots.push({
      ingredientId: ingredientInput.ingredientId,
      ingredientName: ingredientInput.ingredientName,
      amount: actualAmount,
      unit: ingredientInput.unit,
      gramsEquivalent: roundNutrition(actualUsedQuantity),
      kcal: nutrition.kcal,
      protein: nutrition.protein,
      carb: nutrition.carb,
      fat: nutrition.fat
    });

    const currentUsedQuantity = usedQuantityByIngredientId.get(ingredientInput.ingredientId) ?? 0;

    usedQuantityByIngredientId.set(
      ingredientInput.ingredientId,
      currentUsedQuantity + actualUsedQuantity
    );

    remainingQuantityByIngredientId.set(
      ingredientInput.ingredientId,
      Math.max(availableQuantity - actualUsedQuantity, 0)
    );
  }

  if (insufficientMessages.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Nguyên liệu trong tủ lạnh không đủ để nấu món này: ${insufficientMessages.join('; ')}`
    );
  }

  if (snapshots.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Không có nguyên liệu nào trong tủ lạnh để ghi nhận bữa ăn này'
    );
  }

  return {
    snapshots,
    usedQuantityByIngredientId
  };
};

const createMealLogAndDeductFridge = async ({
  userId,
  ingredientIds,
  nutritionIngredients,
  allowMissingIngredients,
  mealLogData,
  deductionName
}: CreateMealLogAndDeductInput): Promise<number> => {
  return prisma.$transaction(async (tx) => {
    const { fridgeId, fridgeItems, availableQuantityByIngredientId } =
      await fridgeInventoryPort.getFridgeContext(tx, userId, ingredientIds);

    const { snapshots, usedQuantityByIngredientId } = buildSnapshotsByAvailableQuantity(
      nutritionIngredients,
      availableQuantityByIngredientId,
      allowMissingIngredients
    );

    const totals = calculateTotalNutrition(snapshots);

    const createdMealLog = await tx.mealLog.create({
      data: {
        ...mealLogData,
        ...totals,
        snapshots: {
          create: snapshots
        }
      },
      select: {
        id: true
      }
    });

    await fridgeInventoryPort.deductFridgeItems(
      tx,
      fridgeId,
      fridgeItems,
      usedQuantityByIngredientId,
      deductionName
    );

    return createdMealLog.id;
  }, transactionOptions);
};

const createMealFromExistingDish = async (
  userId: number,
  payload: CreateMealInput
): Promise<MealHistoryDetail> => {
  const {
    dishId,
    mealType,
    note,
    eatenAt,
    missingIngredientIds = [],
    allowMissingIngredients = false
  } = payload;

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

  const nutritionIngredients: NutritionIngredientInput[] = usedIngredients.map(
    (dishIngredient) => ({
      ingredientId: dishIngredient.ingredientId,
      ingredientName: dishIngredient.ingredient.name,
      amount: dishIngredient.amount,
      unit: dishIngredient.unit,
      gramsEquivalent: dishIngredient.gramsEquivalent,
      ingredient: dishIngredient.ingredient
    })
  );

  const ingredientIds = [
    ...new Set(nutritionIngredients.map((ingredient) => ingredient.ingredientId))
  ];

  const mealLogId = await createMealLogAndDeductFridge({
    userId,
    ingredientIds,
    nutritionIngredients,
    allowMissingIngredients,
    mealLogData: {
      userId,
      dishId: dish.id,
      isCustom: false,
      ...(mealType !== undefined ? { mealType } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(eatenAt !== undefined ? { eatenAt } : {})
    },
    deductionName: dish.name
  });

  return getMealHistoryById(userId, mealLogId);
};

const createCustomMeal = async (
  userId: number,
  payload: CreateMealInput
): Promise<MealHistoryDetail> => {
  const {
    customName,
    mealType,
    note,
    eatenAt,
    customIngredients = [],
    allowMissingIngredients = false
  } = payload;

  if (!customName) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tên bữa ăn tự tạo là bắt buộc');
  }

  if (customIngredients.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bữa ăn tự tạo cần có ít nhất một nguyên liệu');
  }

  const ingredientIds = [
    ...new Set(customIngredients.map((ingredient) => ingredient.ingredientId))
  ];

  const ingredientMap = await getIngredientsByIds(ingredientIds);

  const nutritionIngredients: NutritionIngredientInput[] = customIngredients.map(
    (input: MealIngredientInput) => {
      const ingredient = ingredientMap.get(input.ingredientId);

      if (!ingredient) {
        throw new ApiError(httpStatus.NOT_FOUND, `Nguyên liệu ${input.ingredientId} không tồn tại`);
      }

      return {
        ingredientId: input.ingredientId,
        ingredientName: ingredient.name,
        amount: input.amount,
        unit: input.unit,
        gramsEquivalent: input.gramsEquivalent,
        ingredient
      };
    }
  );

  const mealLogId = await createMealLogAndDeductFridge({
    userId,
    ingredientIds,
    nutritionIngredients,
    allowMissingIngredients,
    mealLogData: {
      userId,
      dishId: null,
      customName,
      isCustom: true,
      tag: '#custom',
      ...(mealType !== undefined ? { mealType } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(eatenAt !== undefined ? { eatenAt } : {})
    },
    deductionName: customName
  });

  return getMealHistoryById(userId, mealLogId);
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
