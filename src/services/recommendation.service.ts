import httpStatus from 'http-status';
import { Prisma, RecommendationStatus } from '@prisma/client';
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
  IRecommendationOutput
} from '../models/interfaces/recommendation.interface';
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

export default {
  createRecommendationJob,
  getAllRecommendationJobs,
  getRecommendationJobById,
  generateRecommendation
};
