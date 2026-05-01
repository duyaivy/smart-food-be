import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { Prisma, RecommendationStatus } from '@prisma/client';
import prisma from '../client';
import redis from '../redis';
import logger from '../config/logger';
import notificationService from './notification.service';
import {
  RECOMMENDATION_JOB_CACHE_KEY,
  RECOMMENDATION_JOB_CACHE_TTL,
  RECOMMENDATION_QUEUE_NAME
} from '../constants/cache.constants';
import { IRecommendationWorkerInput } from '../models/interfaces/recommendation.interface';

const RECOMMENDATION_OUTPUT_TEMPLATE = {
  status: 'SUCCESS',
  plan: [
    {
      day: 1,
      date: '2026-04-21T00:00:00.000Z',
      meals: {
        breakfast: [
          {
            dishId: 101,
            role: 'MAINDISH',
            missingIngredient: [{ ingredientId: 11, unit: 'GAM', quantity: 150 }]
          },
          { dishId: 102, role: 'VEGETABLE', missingIngredient: [] }
        ],
        lunch: [
          {
            dishId: 201,
            role: 'MAINDISH',
            missingIngredient: [{ ingredientId: 7, unit: 'GAM', quantity: 200 }]
          },
          { dishId: 202, role: 'SOUP', missingIngredient: [] },
          {
            dishId: 203,
            role: 'VEGETABLE',
            missingIngredient: [{ ingredientId: 15, unit: 'NUMBER', quantity: 1 }]
          }
        ],
        dinner: [
          { dishId: 301, role: 'MAINDISH', missingIngredient: [] },
          {
            dishId: 302,
            role: 'SOUP',
            missingIngredient: [{ ingredientId: 18, unit: 'GAM', quantity: 100 }]
          },
          { dishId: 303, role: 'VEGETABLE', missingIngredient: [] }
        ]
      },
      nutrition: { calories: 1980, protein: 110, carb: 230, fat: 55 }
    },
    {
      day: 2,
      date: '2026-04-22T00:00:00.000Z',
      meals: {
        breakfast: [
          { dishId: 103, role: 'MAINDISH', missingIngredient: [] },
          {
            dishId: 104,
            role: 'VEGETABLE',
            missingIngredient: [{ ingredientId: 21, unit: 'GAM', quantity: 120 }]
          }
        ],
        lunch: [
          { dishId: 204, role: 'MAINDISH', missingIngredient: [] },
          {
            dishId: 205,
            role: 'SOUP',
            missingIngredient: [{ ingredientId: 22, unit: 'NUMBER', quantity: 2 }]
          },
          { dishId: 206, role: 'VEGETABLE', missingIngredient: [] }
        ],
        dinner: [
          {
            dishId: 304,
            role: 'MAINDISH',
            missingIngredient: [{ ingredientId: 30, unit: 'GAM', quantity: 180 }]
          },
          { dishId: 305, role: 'SOUP', missingIngredient: [] },
          { dishId: 306, role: 'VEGETABLE', missingIngredient: [] }
        ]
      },
      nutrition: { calories: 2050, protein: 115, carb: 240, fat: 58 }
    },
    {
      day: 3,
      date: '2026-04-23T00:00:00.000Z',
      meals: {
        breakfast: [
          { dishId: 105, role: 'MAINDISH', missingIngredient: [] },
          { dishId: 106, role: 'VEGETABLE', missingIngredient: [] }
        ],
        lunch: [
          {
            dishId: 207,
            role: 'MAINDISH',
            missingIngredient: [{ ingredientId: 31, unit: 'GAM', quantity: 250 }]
          },
          { dishId: 208, role: 'SOUP', missingIngredient: [] },
          { dishId: 209, role: 'VEGETABLE', missingIngredient: [] }
        ],
        dinner: [
          { dishId: 307, role: 'MAINDISH', missingIngredient: [] },
          {
            dishId: 308,
            role: 'SOUP',
            missingIngredient: [{ ingredientId: 32, unit: 'NUMBER', quantity: 1 }]
          },
          {
            dishId: 309,
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
  ]
};

const getBullMQConnection = (): ConnectionOptions => {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined
    };
  }
  return { host: '127.0.0.1', port: 6379 };
};

let recommendationQueue: Queue | null = null;

const getQueue = (): Queue => {
  if (!recommendationQueue) {
    if (!redis) {
      throw new Error('[RecommendationQueue] Redis is not available — cannot initialise queue');
    }
    recommendationQueue = new Queue(RECOMMENDATION_QUEUE_NAME, {
      connection: getBullMQConnection()
    });
  }
  return recommendationQueue;
};

export const enqueueRecommendationJob = async (jobId: number): Promise<void> => {
  const queue = getQueue();
  const queueJobId = `recommendation-${jobId}`;
  await queue.add('process', { jobId }, { jobId: queueJobId });
  logger.info(`[RecommendationQueue] Enqueued job jobId=${jobId}`);
};

export const initRecommendationWorker = (): void => {
  if (!redis) {
    logger.warn('[RecommendationWorker] Redis unavailable — worker not started');
    return;
  }

  const worker = new Worker(
    RECOMMENDATION_QUEUE_NAME,
    async (job: Job) => {
      const { jobId } = job.data as { jobId: number };
      logger.info(`[RecommendationWorker] Processing jobId=${jobId}`);

      // 1. Mark as PROCESSING
      await prisma.recommendation.update({
        where: { id: jobId },
        data: { status: RecommendationStatus.PROCESSING }
      });

      // 2. Read input from DB
      const jobRecord = await prisma.recommendation.findUnique({
        where: { id: jobId }
      });

      if (!jobRecord) {
        throw new Error(`[RecommendationWorker] Job ${jobId} not found in DB`);
      }

      const workerInput = jobRecord.input as unknown as IRecommendationWorkerInput;
      void workerInput;

      // 3. Use fixed output payload template
      const output = RECOMMENDATION_OUTPUT_TEMPLATE;

      // 4. Update DB with SUCCESS + output
      await prisma.recommendation.update({
        where: { id: jobId },
        data: {
          status: RecommendationStatus.SUCCESS,
          output: output as unknown as Prisma.InputJsonValue
        }
      });

      // 5. Cache in Redis for 7 days
      if (redis) {
        await redis.set(
          RECOMMENDATION_JOB_CACHE_KEY(jobId),
          JSON.stringify({ ...jobRecord, status: RecommendationStatus.SUCCESS, output }),
          'EX',
          RECOMMENDATION_JOB_CACHE_TTL
        );
        logger.info(`[RecommendationWorker] Cached result for jobId=${jobId}`);
      }

      // 6. Send silent push notification (best-effort)
      try {
        await notificationService.sendNotificationToUser(jobRecord.userId, {
          title: 'Gợi ý thực đơn đã sẵn sàng',
          body: 'Kế hoạch ăn uống của bạn đã được tạo. Hãy kiểm tra ngay!',
          data: { type: 'RECOMMENDATION_READY', jobId: String(jobId) }
        });
      } catch (notifError) {
        // Push notification failure must NOT fail the job
        logger.warn(
          `[RecommendationWorker] Push notification failed for jobId=${jobId}: ${notifError}`
        );
      }

      logger.info(`[RecommendationWorker] jobId=${jobId} completed successfully`);
    },
    { connection: getBullMQConnection() }
  );

  worker.on('failed', async (job, err) => {
    const jobId = (job?.data as { jobId: number })?.jobId;
    logger.error(`[RecommendationWorker] jobId=${jobId} failed: ${err.message}`);

    if (jobId) {
      try {
        await prisma.recommendation.update({
          where: { id: jobId },
          data: { status: RecommendationStatus.FAILED }
        });
      } catch (dbErr) {
        logger.error(`[RecommendationWorker] Failed to mark jobId=${jobId} as FAILED: ${dbErr}`);
      }
    }
  });

  worker.on('error', (err) => {
    logger.error(`[RecommendationWorker] Worker error: ${err.message}`);
  });

  logger.info('[RecommendationWorker] Worker initialised and listening');
};
