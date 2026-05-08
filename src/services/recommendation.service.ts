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
        breakfast: [
          {
            dishId: 6,
            role: 'MAIN_DISH',
            missingIngredient: [{ ingredientId: 11, unit: 'GAM', quantity: 150 }]
          },
          { dishId: 9, role: 'VEGETABLE', missingIngredient: [] }
        ],
        lunch: [
          {
            dishId: 2,
            role: 'MAIN_DISH',
            missingIngredient: [{ ingredientId: 7, unit: 'GAM', quantity: 200 }]
          },
          { dishId: 3, role: 'SOUP', missingIngredient: [] },
          {
            dishId: 6,
            role: 'VEGETABLE',
            missingIngredient: [{ ingredientId: 15, unit: 'NUMBER', quantity: 1 }]
          }
        ],
        dinner: [
          { dishId: 7, role: 'MAIN_DISH', missingIngredient: [] },
          {
            dishId: 11,
            role: 'SOUP',
            missingIngredient: [{ ingredientId: 18, unit: 'GAM', quantity: 100 }]
          },
          { dishId: 7, role: 'VEGETABLE', missingIngredient: [] }
        ]
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
  message: 'Đây là gợi ý thực đơn 3 ngày dành cho bạn để đạt được mục tiêu cân nặng.'
};
// ─── Create ───────────────────────────────────────────────────────────────────

const createRecommendationJob = async (
  body: IRecommendationJobRequest,
  userId?: number
): Promise<{ jobId: number; status: string }> => {
  const finalUserId = userId ?? 1;
  const isReplan = body.lockedPicks && body.lockedPicks.length > 0;

  if (isReplan) {
    console.log(
      `[RecommendationService] Replanning for user=${finalUserId}. Discarding previous results.`
    );
  } else {
    console.log(`[RecommendationService] Creating new recommendation for user=${finalUserId}.`);
  }

  const workerInput = await recommendationInputHydrationService.hydrateWorkerInput(
    body,
    finalUserId
  );

  // 2. Persist job record in DB with PENDING status
  const job = await prisma.recommendation.create({
    data: {
      userId: finalUserId,
      status: RecommendationStatus.PENDING,
      input: workerInput as unknown as Prisma.InputJsonValue,
      output: Prisma.JsonNull
    }
  });

  // 3. Enqueue for async processing
  await enqueueRecommendationJob(job.id);

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
    logger.info('[RecommendationService] Using MOCK data for recommendation');
    return RECOMMENDATION_OUTPUT_TEMPLATE as IRecommendationOutput;
  }

  logger.info(`[RecommendationService] Calling external API at ${config.recommendation.url}`);
  try {
    const response = await apiClient.post(config.recommendation.url, workerInput);

    return response.data as IRecommendationOutput;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    logger.error(`[RecommendationService] External API call failed: ${errorMessage}`);
    logger.error(JSON.stringify(error));
    logger.info('[RecommendationService] Falling back to MOCK data due to API error');
    return RECOMMENDATION_OUTPUT_TEMPLATE as unknown as IRecommendationOutput;
  }
};

export default {
  createRecommendationJob,
  getAllRecommendationJobs,
  getRecommendationJobById,
  generateRecommendation
};
