import httpStatus from 'http-status';
import { Prisma, RecommendationStatus, Unit } from '@prisma/client';
import prisma from '../../client';
import redis from '../../redis';
import ApiError from '../../utils/apiError';
import recommendationInputHydrationService from './inputHydration.service';
import { enqueueRecommendationJob } from './queue.service';
import { getWorkerInputLogContext } from './aiAdapter.service';
import recommendationNutritionService from './nutrition.service';
import {
  RECOMMENDATION_JOB_CACHE_KEY,
  RECOMMENDATION_JOB_CACHE_TTL
} from '../../constants/cache.constants';
import {
  IRecommendationJobRequest,
  IRecommendationJobResponse,
  IRecommendationOutput,
  IDayMeals,
  IMealDish,
  RecommendationRole
} from '../../models/interfaces/recommendation.interface';
import logger from '../../config/logger';
import { roundNutrition } from '../../utils/calc';

const getCreateRequestLogContext = (body: IRecommendationJobRequest, userId: number) => ({
  userId,
  planDays: body.planDays,
  startDate: body.startDate,
  isReplan: Boolean(body.lockedPicks?.length),
  lockedPicksCount: body.lockedPicks?.length ?? 0,
  mealTypes: Object.keys(body.mealStructure)
});

const mapJobToResponse = (job: {
  id: number;
  status: RecommendationStatus;
  userId: number;
  input: Prisma.JsonValue;
  output: Prisma.JsonValue | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}): IRecommendationJobResponse => ({
  jobId: job.id,
  status: job.status,
  userId: job.userId,
  input: job.input as unknown as IRecommendationJobResponse['input'],
  output: (job.output ?? null) as unknown as IRecommendationJobResponse['output'],
  message: job.message ?? '',
  createdAt: job.createdAt,
  updatedAt: job.updatedAt
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

  return jobs.map(mapJobToResponse);
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

  const response = mapJobToResponse(job);

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

    const output = job.output as unknown as IRecommendationOutput;
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
        role: swap.role as RecommendationRole,
        missingIngredient: swap.missingIngredient.map((mi) => ({
          ingredientId: mi.ingredientId,
          unit: mi.unit,
          quantity: mi.quantity
        }))
      };
    }

    // 4. Recalculate day's nutrition values using helper
    const dayDishIds: number[] = [];
    const addIds = (dishes: IMealDish[]) => {
      for (const d of dishes) {
        dayDishIds.push(d.dishId);
      }
    };
    addIds(planDay.meals.breakfast || []);
    addIds(planDay.meals.lunch || []);
    addIds(planDay.meals.dinner || []);

    planDay.nutrition = await recommendationNutritionService.calculateDishesNutrition(
      tx,
      dayDishIds
    );

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
    output.shoppingList = recommendationNutritionService.rebuildShoppingList(output.plan);

    // 7. Update database record
    const updatedJob = await tx.recommendation.update({
      where: { id: jobId },
      data: {
        output: output as unknown as Prisma.InputJsonValue
      }
    });

    const response = mapJobToResponse(updatedJob);

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
  updateRecommendation
};
