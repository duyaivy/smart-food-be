import httpStatus from 'http-status';
import { Prisma, RecommendationStatus, Unit } from '@prisma/client';
import prisma from '../client';
import redis from '../redis';
import ApiError from '../utils/apiError';
import recommendationInputHydrationService from './recommendation.inputHydration.service';
import { enqueueRecommendationJob } from './recommendation.queue.service';
import {
  RECOMMENDATION_JOB_CACHE_KEY,
  RECOMMENDATION_JOB_CACHE_TTL
} from '../constants/cache.constants';
import {
  IRecommendationJobRequest,
  IRecommendationJobResponse,
  IRecommendationWorkerInput,
  IRecommendationOutput,
  IDayMeals
} from '../models/interfaces/recommendation.interface';
import { calculateIngredientNutrition, roundNutrition } from '../utils/calc';
import config from '../config/config';
import logger from '../config/logger';
import apiClient from '../config/axios';

const RECOMMENDATION_OUTPUT_TEMPLATE: IRecommendationOutput = {
  status: 'FAILED',
  plan: [
    {
      day: 1,
      date: '2026-04-21T00:00:00.000Z',
      meals: {
        breakfast: [],
        lunch: [],
        dinner: []
      },
      nutrition: { calories: 1980, protein: 110, carb: 230, fat: 55 }
    },
    {
      day: 2,
      date: '2026-04-22T00:00:00.000Z',
      meals: {
        breakfast: [
          { dishId: 6, role: 'MAIN_DISH', missingIngredient: [] },
          {
            dishId: 3,
            role: 'VEGETABLE',
            missingIngredient: [{ ingredientId: 21, unit: 'GAM', quantity: 120 }]
          }
        ],
        lunch: [
          { dishId: 9, role: 'MAIN_DISH', missingIngredient: [] },
          {
            dishId: 3,
            role: 'SOUP',
            missingIngredient: [{ ingredientId: 22, unit: 'NUMBER', quantity: 2 }]
          },
          { dishId: 6, role: 'VEGETABLE', missingIngredient: [] }
        ],
        dinner: [
          {
            dishId: 7,
            role: 'MAIN_DISH',
            missingIngredient: [{ ingredientId: 30, unit: 'GAM', quantity: 180 }]
          },
          { dishId: 11, role: 'SOUP', missingIngredient: [] },
          { dishId: 7, role: 'VEGETABLE', missingIngredient: [] }
        ]
      },
      nutrition: { calories: 2050, protein: 115, carb: 240, fat: 58 }
    },
    {
      day: 3,
      date: '2026-04-23T00:00:00.000Z',
      meals: {
        breakfast: [
          { dishId: 6, role: 'MAIN_DISH', missingIngredient: [] },
          { dishId: 3, role: 'VEGETABLE', missingIngredient: [] }
        ],
        lunch: [
          {
            dishId: 9,
            role: 'MAIN_DISH',
            missingIngredient: [{ ingredientId: 31, unit: 'GAM', quantity: 250 }]
          },
          { dishId: 3, role: 'SOUP', missingIngredient: [] },
          { dishId: 6, role: 'VEGETABLE', missingIngredient: [] }
        ],
        dinner: [
          { dishId: 7, role: 'MAIN_DISH', missingIngredient: [] },
          {
            dishId: 11,
            role: 'SOUP',
            missingIngredient: [{ ingredientId: 32, unit: 'NUMBER', quantity: 1 }]
          },
          {
            dishId: 7,
            role: 'VEGETABLE',
            missingIngredient: [{ ingredientId: 33, unit: 'GAM', quantity: 80 }]
          }
        ]
      },
      nutrition: { calories: 2100, protein: 120, carb: 245, fat: 60 }
    }
  ],
  summary: {
    avgDailyCalories: 2043.33,
    targetCalories: 14350,
    deviation: -0.32,
    avgDailyProtein: 115,
    avgDailyCarbs: 238.33,
    avgDailyFat: 57.67
  },
  shoppingList: [
    { ingredientId: 7, quantity: 200, unit: 'GAM' },
    { ingredientId: 11, quantity: 150, unit: 'GAM' },
    { ingredientId: 15, quantity: 1, unit: 'NUMBER' },
    { ingredientId: 18, quantity: 100, unit: 'GAM' },
    { ingredientId: 21, quantity: 120, unit: 'GAM' },
    { ingredientId: 22, quantity: 2, unit: 'NUMBER' },
    { ingredientId: 30, quantity: 180, unit: 'GAM' },
    { ingredientId: 31, quantity: 250, unit: 'GAM' },
    { ingredientId: 32, quantity: 1, unit: 'NUMBER' },
    { ingredientId: 33, quantity: 80, unit: 'GAM' }
  ],
  message: 'Kết nối đến hệ thống không ổn định, vui lòng thử lại sau.'
};
// ─── Create ───────────────────────────────────────────────────────────────────

const getCreateRequestLogContext = (body: IRecommendationJobRequest, userId: number) => ({
  userId,
  planDays: body.planDays,
  startDate: body.startDate,
  isReplan: Boolean(body.lockedPicks?.length),
  lockedPicksCount: body.lockedPicks?.length ?? 0,
  mealTypes: Object.keys(body.mealStructure)
});

const getWorkerInputLogContext = (workerInput: IRecommendationWorkerInput) => ({
  userId: workerInput.userId,
  planDays: workerInput.planDays,
  startDate: workerInput.startDate,
  lockedPicksCount: workerInput.lockedPicks?.length ?? 0,
  fridgeItemsCount: workerInput.fridge.length,
  recentMealLogCount: workerInput.recentMealLog.length,
  mealTypes: Object.keys(workerInput.mealStructure)
});

const createRecommendationJob = async (
  body: IRecommendationJobRequest,
  userId?: number
): Promise<{ jobId: number; status: string }> => {
  const startedAt = Date.now();
  const finalUserId = userId ?? 1;
  const isReplan = body.lockedPicks && body.lockedPicks.length > 0;

  logger.info('[RecommendationService][create:request] Create recommendation requested', {
    ...getCreateRequestLogContext(body, finalUserId),
    mode: isReplan ? 'REPLAN' : 'CREATE'
  });

  const hydrateStartedAt = Date.now();
  logger.info('[RecommendationService][create:hydrate:start] Hydrating worker input', {
    ...getCreateRequestLogContext(body, finalUserId)
  });
  const workerInput = await recommendationInputHydrationService.hydrateWorkerInput(
    body,
    finalUserId
  );
  logger.info('[RecommendationService][create:hydrate:done] Worker input hydrated', {
    durationMs: Date.now() - hydrateStartedAt,
    ...getWorkerInputLogContext(workerInput)
  });

  // 2. Persist job record in DB with PENDING status
  logger.info('[RecommendationService][create:db:start] Creating PENDING recommendation job', {
    userId: finalUserId
  });
  const job = await prisma.recommendation.create({
    data: {
      userId: finalUserId,
      status: RecommendationStatus.PENDING,
      input: workerInput as unknown as Prisma.InputJsonValue,
      output: Prisma.JsonNull
    }
  });
  logger.info('[RecommendationService][create:db:done] PENDING recommendation job created', {
    jobId: job.id,
    userId: job.userId,
    status: job.status
  });

  // 3. Enqueue for async processing
  logger.info('[RecommendationService][create:enqueue:start] Enqueuing recommendation job', {
    jobId: job.id,
    userId: job.userId
  });

  // Invalidate any existing cache for this jobId (in case of DB resets)
  if (redis) {
    const cacheKey = RECOMMENDATION_JOB_CACHE_KEY(job.id);
    await redis.del(cacheKey).catch((err) => {
      logger.warn(
        '[RecommendationService][create:cache_clear:failed] Failed to clear stale cache',
        {
          jobId: job.id,
          error: err.message
        }
      );
    });
  }

  await enqueueRecommendationJob(job.id);
  logger.info('[RecommendationService][create:enqueue:done] Recommendation job enqueued', {
    jobId: job.id,
    userId: job.userId
  });

  logger.info('[RecommendationService][create:response] Returning recommendation job response', {
    jobId: job.id,
    userId: job.userId,
    status: RecommendationStatus.PENDING,
    durationMs: Date.now() - startedAt
  });
  return { jobId: job.id, status: RecommendationStatus.PENDING };
};

const getAllRecommendationJobs = async (userId: number): Promise<IRecommendationJobResponse[]> => {
  const jobs = await prisma.recommendation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  return jobs.map((job) => ({
    jobId: job.id,
    status: job.status,
    userId: job.userId,
    input: job.input as unknown as IRecommendationJobResponse['input'],
    output: (job.output ?? null) as IRecommendationJobResponse['output'],
    message: job.message ?? '',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  }));
};

const getRecommendationJobById = async (jobId: number): Promise<IRecommendationJobResponse> => {
  // 1. Try Redis cache first
  if (redis) {
    const cached = await redis.get(RECOMMENDATION_JOB_CACHE_KEY(jobId)).catch(() => null);
    if (cached) {
      return JSON.parse(cached) as IRecommendationJobResponse;
    }
  }

  // 2. Fallback to DB
  const job = await prisma.recommendation.findUnique({
    where: { id: jobId }
  });

  if (!job) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy gợi ý');
  }

  const response: IRecommendationJobResponse = {
    jobId: job.id,
    status: job.status,
    userId: job.userId,
    input: job.input as unknown as IRecommendationJobResponse['input'],
    output: (job.output ?? null) as IRecommendationJobResponse['output'],
    message: job.message ?? '',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };

  // 3. Rehydrate cache if job already completed
  if (job.status === 'SUCCESS' && redis) {
    redis
      .set(
        RECOMMENDATION_JOB_CACHE_KEY(jobId),
        JSON.stringify(response),
        'EX',
        RECOMMENDATION_JOB_CACHE_TTL
      )
      .catch(() => null);
  }

  return response;
};

const generateRecommendation = async (
  workerInput: IRecommendationWorkerInput
): Promise<IRecommendationOutput> => {
  if (config.recommendation.useMockData) {
    logger.info('[RecommendationService][generate:mock] Using MOCK data for recommendation', {
      ...getWorkerInputLogContext(workerInput)
    });
    return RECOMMENDATION_OUTPUT_TEMPLATE as IRecommendationOutput;
  }

  const startedAt = Date.now();
  logger.info('[RecommendationService][generate:api:start] Calling external recommendation API', {
    url: config.recommendation.url,
    ...getWorkerInputLogContext(workerInput)
  });
  try {
    const response = await apiClient.post(config.recommendation.url, workerInput);

    logger.info(
      '[RecommendationService][generate:api:done] External recommendation API succeeded',
      {
        url: config.recommendation.url,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        outputStatus: response.data?.status,
        outputPlanDays: response.data?.plan?.length ?? 0,
        shoppingItemsCount: response.data?.shoppingList?.length ?? 0
      }
    );
    return response.data as IRecommendationOutput;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    logger.error(
      '[RecommendationService][generate:api:failed] External recommendation API failed',
      {
        url: config.recommendation.url,
        durationMs: Date.now() - startedAt,
        statusCode: error.response?.status,
        errorMessage,
        responseData: error.response?.data
      }
    );
    logger.info(
      '[RecommendationService][generate:fallback] Falling back to MOCK data due to API error'
    );
    return RECOMMENDATION_OUTPUT_TEMPLATE as unknown as IRecommendationOutput;
  }
};

const getMissingIngredients = (
  dishIngredients: any[],
  fridgeList: { ingredientId: number; quantity: number }[]
) => {
  const missing: any[] = [];
  for (const di of dishIngredients) {
    if (di.unit === 'SPOON') {
      continue;
    }
    const totalAvailable = fridgeList
      .filter((item) => item.ingredientId === di.ingredientId)
      .reduce((sum, item) => sum + item.quantity, 0);

    if (totalAvailable < di.amount) {
      missing.push({
        ingredientId: di.ingredientId,
        unit: di.unit,
        quantity: Math.max(0, Number((di.amount - totalAvailable).toFixed(2)))
      });
    }
  }
  return missing;
};

const calculateDishesNutrition = async (tx: Prisma.TransactionClient, dishIds: number[]) => {
  if (dishIds.length === 0) {
    return { calories: 0, protein: 0, carb: 0, fat: 0 };
  }

  const dishes = await tx.dish.findMany({
    where: { id: { in: dishIds } },
    include: {
      ingredients: {
        include: {
          ingredient: true
        }
      }
    }
  });

  let calories = 0;
  let protein = 0;
  let carb = 0;
  let fat = 0;

  for (const dishId of dishIds) {
    const dish = dishes.find((d) => d.id === dishId);
    if (dish) {
      let dishCal = dish.calories ?? 0;
      let dishProtein = 0;
      let dishCarb = 0;
      let dishFat = 0;
      let calculatedCal = 0;

      for (const di of dish.ingredients) {
        const nut = calculateIngredientNutrition(di.ingredient, di.gramsEquivalent);
        dishProtein += nut.protein;
        dishCarb += nut.carb;
        dishFat += nut.fat;
        calculatedCal += nut.kcal;
      }

      if (!dishCal) {
        dishCal = calculatedCal;
      }

      calories += dishCal;
      protein += dishProtein;
      carb += dishCarb;
      fat += dishFat;
    }
  }

  return {
    calories: roundNutrition(calories),
    protein: roundNutrition(protein),
    carb: roundNutrition(carb),
    fat: roundNutrition(fat)
  };
};

const rebuildShoppingList = (plan: any[]): any[] => {
  const shoppingMap = new Map<string, { ingredientId: number; unit: Unit; quantity: number }>();
  const processMeals = (dishes: any[]) => {
    for (const md of dishes) {
      for (const mi of md.missingIngredient) {
        if (mi.unit === 'SPOON') {
          continue;
        }
        const key = `${mi.ingredientId}_${mi.unit}`;
        const existing = shoppingMap.get(key);
        if (existing) {
          existing.quantity += mi.quantity;
        } else {
          shoppingMap.set(key, {
            ingredientId: mi.ingredientId,
            unit: mi.unit,
            quantity: mi.quantity
          });
        }
      }
    }
  };

  for (const d of plan) {
    processMeals(d.meals.breakfast || []);
    processMeals(d.meals.lunch || []);
    processMeals(d.meals.dinner || []);
  }

  return Array.from(shoppingMap.values()).map((item) => ({
    ingredientId: item.ingredientId,
    unit: item.unit,
    quantity: roundNutrition(item.quantity)
  }));
};

const getSubRecommendations = async (
  userId: number,
  dishIds: number[],
  jobId?: number
): Promise<{ originalDishId: number; recommendations: any[] }[]> => {
  // 1. Fetch user's fridge items
  let fridgeItems: { ingredientId: number; quantity: number }[] = [];
  if (jobId) {
    const job = await prisma.recommendation.findUnique({
      where: { id: jobId }
    });
    if (job && job.userId === userId && job.input) {
      const input = job.input as any;
      if (input.fridge) {
        fridgeItems = input.fridge.map((entry: any) => ({
          ingredientId: entry.ingredientId,
          quantity: entry.quantity
        }));
      }
    }
  }

  if (fridgeItems.length === 0) {
    const fridge = await prisma.fridge.findUnique({
      where: { userId },
      include: {
        items: {
          where: { deleteAt: null }
        }
      }
    });
    if (fridge) {
      fridgeItems = fridge.items;
    }
  }

  const results = [];

  for (const originalDishId of dishIds) {
    const originalDish = await prisma.dish.findUnique({
      where: { id: originalDishId }
    });

    if (!originalDish || originalDish.isDeleted) {
      continue;
    }

    const targetCalories = originalDish.calories ?? 0;

    // Use raw query to retrieve only the top 5 closest dishes directly from DB
    const top5Dishes = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Dish"
      WHERE "type" = ${originalDish.type}::"DishType"
        AND "id" <> ${originalDishId}
        AND "isDeleted" = false
        AND "calories" IS NOT NULL
      ORDER BY ABS("calories" - ${targetCalories}) ASC
      LIMIT 5
    `;

    const candidateIds = top5Dishes.map((d) => d.id);

    if (candidateIds.length === 0) {
      results.push({
        originalDishId,
        recommendations: []
      });
      continue;
    }

    // Now query the full data including ingredients for the top 5 candidates
    const candidates = await prisma.dish.findMany({
      where: {
        id: { in: candidateIds }
      },
      include: {
        ingredients: {
          include: {
            ingredient: true
          }
        }
      }
    });

    // Sort to keep the DB-ordered sequence (closest calories first)
    candidates.sort((a, b) => candidateIds.indexOf(a.id) - candidateIds.indexOf(b.id));

    const recommendations = candidates.map((candidate) => {
      const missingIngredients = getMissingIngredients(candidate.ingredients, fridgeItems);

      return {
        dishId: candidate.id,
        role: candidate.type,
        name: candidate.name,
        calories: candidate.calories,
        images: candidate.images,
        missingIngredient: missingIngredients
      };
    });

    results.push({
      originalDishId,
      recommendations
    });
  }

  return results;
};

const updateRecommendation = async (
  userId: number,
  params: {
    jobId: number;
    day: number;
    meal: string;
    swaps: {
      originalDishId: number;
      dishId: number;
      role: string;
      missingIngredient: {
        ingredientId: number;
        unit: Unit;
        quantity: number;
      }[];
    }[];
  }
): Promise<IRecommendationJobResponse> => {
  const { jobId, day, meal, swaps } = params;
  const mealKey = meal.toLowerCase();

  if (mealKey !== 'breakfast' && mealKey !== 'lunch' && mealKey !== 'dinner') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bữa ăn không hợp lệ');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Fetch recommendation
    const job = await tx.recommendation.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy gợi ý thực đơn');
    }

    if (job.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền cập nhật gợi ý này');
    }

    if (!job.output) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Gợi ý chưa được tạo thành công');
    }

    const output = job.output as any as IRecommendationOutput;
    if (!output.plan || !Array.isArray(output.plan)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Định dạng gợi ý không hợp lệ');
    }

    // 2. Find day in plan
    const planDay = output.plan.find((p) => p.day === day);
    if (!planDay) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Không tìm thấy ngày ${day} trong kế hoạch`);
    }

    const mealDishes = planDay.meals[mealKey as keyof IDayMeals] || [];

    // 3. Process all swaps
    for (const swap of swaps) {
      const dishIndex = mealDishes.findIndex((md) => md.dishId === swap.originalDishId);
      if (dishIndex === -1) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Không tìm thấy món ăn gốc với id ${swap.originalDishId} trong bữa ${meal} của ngày ${day}`
        );
      }

      // Replace with new dish direct representation (without recalculating from DB)
      mealDishes[dishIndex] = {
        dishId: swap.dishId,
        role: swap.role as any,
        missingIngredient: swap.missingIngredient.map((mi) => ({
          ingredientId: mi.ingredientId,
          unit: mi.unit,
          quantity: mi.quantity
        }))
      };
    }

    // 4. Recalculate day's nutrition values using helper
    const dayDishIds: number[] = [];
    const addIds = (dishes: any[]) => {
      for (const d of dishes) {
        dayDishIds.push(d.dishId);
      }
    };
    addIds(planDay.meals.breakfast || []);
    addIds(planDay.meals.lunch || []);
    addIds(planDay.meals.dinner || []);

    planDay.nutrition = await calculateDishesNutrition(tx, dayDishIds);

    // 5. Recalculate summary nutrition values
    const numDays = output.plan.length;
    const totalCalories = output.plan.reduce((sum, d) => sum + d.nutrition.calories, 0);
    const totalProtein = output.plan.reduce((sum, d) => sum + d.nutrition.protein, 0);
    const totalCarbs = output.plan.reduce((sum, d) => sum + d.nutrition.carb, 0);
    const totalFat = output.plan.reduce((sum, d) => sum + d.nutrition.fat, 0);

    const avgDailyCalories = roundNutrition(totalCalories / numDays);
    const avgDailyProtein = roundNutrition(totalProtein / numDays);
    const avgDailyCarbs = roundNutrition(totalCarbs / numDays);
    const avgDailyFat = roundNutrition(totalFat / numDays);

    const targetDailyCalories = output.summary.targetCalories / numDays;
    const deviation =
      targetDailyCalories > 0
        ? roundNutrition((avgDailyCalories - targetDailyCalories) / targetDailyCalories)
        : 0;

    output.summary = {
      avgDailyCalories,
      targetCalories: output.summary.targetCalories,
      deviation,
      avgDailyProtein,
      avgDailyCarbs,
      avgDailyFat
    };

    // 6. Rebuild shopping list using helper
    output.shoppingList = rebuildShoppingList(output.plan);

    // 7. Update database record
    const updatedJob = await tx.recommendation.update({
      where: { id: jobId },
      data: {
        output: output as any
      }
    });

    const response: IRecommendationJobResponse = {
      jobId: updatedJob.id,
      status: updatedJob.status,
      userId: updatedJob.userId,
      input: updatedJob.input as any,
      output: updatedJob.output as any,
      message: updatedJob.message ?? '',
      createdAt: updatedJob.createdAt,
      updatedAt: updatedJob.updatedAt
    };

    // 8. Update Redis cache
    if (redis) {
      const cacheKey = RECOMMENDATION_JOB_CACHE_KEY(jobId);
      await redis
        .set(cacheKey, JSON.stringify(response), 'EX', RECOMMENDATION_JOB_CACHE_TTL)
        .catch(() => null);
    }

    return response;
  });
};

export default {
  createRecommendationJob,
  getAllRecommendationJobs,
  getRecommendationJobById,
  generateRecommendation,
  getSubRecommendations,
  updateRecommendation
};
