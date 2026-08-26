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

import recommendationService from './recommendation.service';

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
let recommendationWorker: Worker | null = null;

const getWorkerInputLogContext = (workerInput: IRecommendationWorkerInput) => ({
  userId: workerInput.userId,
  planDays: workerInput.planDays,
  startDate: workerInput.startDate,
  lockedPicksCount: workerInput.lockedPicks?.length ?? 0,
  fridgeItemsCount: workerInput.fridge.length,
  recentMealLogCount: workerInput.recentMealLog.length,
  mealTypes: Object.keys(workerInput.mealStructure)
});

const getQueue = (): Queue => {
  if (!recommendationQueue) {
    if (!redis) {
      throw new Error('[RecommendationQueue] Redis is not available - cannot initialise queue');
    }
    recommendationQueue = new Queue(RECOMMENDATION_QUEUE_NAME, {
      connection: getBullMQConnection()
    });
  }
  return recommendationQueue;
};

export const enqueueRecommendationJob = async (jobId: number): Promise<void> => {
  const queue = getQueue();
  logger.info('[RecommendationQueue][enqueue:start] Adding recommendation job to queue', {
    jobId,
    queueName: RECOMMENDATION_QUEUE_NAME
  });
  const queueJob = await queue.add('process', { jobId });
  logger.info('[RecommendationQueue][enqueue:done] Recommendation job enqueued', {
    jobId,
    queueJobId: queueJob.id,
    queueName: RECOMMENDATION_QUEUE_NAME
  });

  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  logger.info('[RecommendationQueue][enqueue:counts] Queue job counts after enqueue', {
    jobId,
    queueJobId: queueJob.id,
    counts
  });
};

const WORKER_ID = Math.random().toString(36).substring(2, 9).toUpperCase();

export const initRecommendationWorker = (): void => {
  if (recommendationWorker) {
    logger.info('[RecommendationWorker] Worker already initialized, skipping');
    return;
  }

  if (!redis) {
    logger.warn('[RecommendationWorker] Redis unavailable - worker not started');
    return;
  }

  const worker = new Worker(
    RECOMMENDATION_QUEUE_NAME,
    async (job: Job) => {
      let jobId: number | undefined;
      try {
        const data = job.data as { jobId: number };
        jobId = data.jobId;

        if (!jobId) {
          logger.error('[RecommendationWorker][job:error] Job data missing jobId', {
            workerId: WORKER_ID,
            queueJobId: job.id,
            data: job.data
          });
          throw new Error('Missing jobId in job data');
        }

        const startedAt = Date.now();
        logger.info('[RecommendationWorker][job:start] Processing recommendation job', {
          workerId: WORKER_ID,
          jobId,
          queueJobId: job.id,
          queueName: RECOMMENDATION_QUEUE_NAME
        });

        logger.info(
          '[RecommendationWorker][db:status_processing:start] Marking job as PROCESSING',
          {
            jobId
          }
        );
        await prisma.recommendation.update({
          where: { id: jobId },
          data: { status: RecommendationStatus.PROCESSING }
        });
        logger.info('[RecommendationWorker][db:status_processing:done] Job marked as PROCESSING', {
          jobId
        });

        logger.info('[RecommendationWorker][db:fetch:start] Fetching job record', { jobId });
        const jobRecord = await prisma.recommendation.findUnique({
          where: { id: jobId }
        });

        if (!jobRecord) {
          logger.error('[RecommendationWorker][db:fetch:failed] Job record not found', { jobId });
          throw new Error(`[RecommendationWorker] Job ${jobId} not found in DB`);
        }
        logger.info('[RecommendationWorker][db:fetch:done] Job record fetched', {
          jobId,
          userId: jobRecord.userId,
          status: jobRecord.status
        });

        const workerInput = jobRecord.input as unknown as IRecommendationWorkerInput;
        logger.info('[RecommendationWorker][input:ready] Worker input loaded', {
          jobId,
          ...getWorkerInputLogContext(workerInput)
        });

        // 3. Generate recommendation (mock or real API)
        const generateStartedAt = Date.now();
        logger.info('[RecommendationWorker][recommendation_api:start] Generating recommendation', {
          jobId,
          ...getWorkerInputLogContext(workerInput)
        });
        const output = await recommendationService.generateRecommendation(workerInput);
        logger.info('[RecommendationWorker][recommendation_api:done] Recommendation generated', {
          jobId,
          durationMs: Date.now() - generateStartedAt,
          outputStatus: output.status,
          outputPlanDays: output.plan?.length ?? 0,
          shoppingItemsCount: output.shoppingList?.length ?? 0,
          hasMessage: Boolean(output.message)
        });

        // 4. Update DB with SUCCESS + output
        logger.info('[RecommendationWorker][db:result_update:start] Saving recommendation result', {
          jobId,
          outputStatus: output.status || RecommendationStatus.FAILED
        });
        await prisma.recommendation.update({
          where: { id: jobId },
          data: {
            status: output.status || RecommendationStatus.FAILED,
            output: output as unknown as Prisma.InputJsonValue,
            message: output.message ?? ''
          }
        });
        logger.info('[RecommendationWorker][db:result_update:done] Recommendation result saved', {
          jobId,
          outputStatus: output.status || RecommendationStatus.FAILED
        });

        // 5. Cache in Redis for 7 days
        if (redis) {
          const cacheKey = RECOMMENDATION_JOB_CACHE_KEY(jobId);
          logger.info('[RecommendationWorker][cache:start] Caching recommendation result', {
            jobId,
            cacheKey,
            ttlSeconds: RECOMMENDATION_JOB_CACHE_TTL
          });
          const cacheData = {
            jobId: jobRecord.id,
            status: output.status || RecommendationStatus.FAILED,
            userId: jobRecord.userId,
            input: jobRecord.input,
            output,
            message: output.message ?? '',
            createdAt: jobRecord.createdAt,
            updatedAt: new Date()
          };
          await redis.set(cacheKey, JSON.stringify(cacheData), 'EX', RECOMMENDATION_JOB_CACHE_TTL);
          logger.info('[RecommendationWorker][cache:done] Recommendation result cached', {
            jobId,
            cacheKey
          });
        } else {
          logger.warn('[RecommendationWorker][cache:skipped] Redis unavailable, skipping cache', {
            jobId
          });
        }

        // 6. Send silent push notification (best-effort)
        try {
          logger.info('[RecommendationWorker][notification:start] Sending ready notification', {
            jobId,
            userId: jobRecord.userId
          });
          await notificationService.sendNotificationToUser(jobRecord.userId, {
            title: 'Gợi ý thực đơn đã sẵn sàng',
            body: 'Kế hoạch ăn uống của bạn đã được tạo. Hãy kiểm tra ngay!',
            data: { type: 'RECOMMENDATION_READY', jobId: String(jobId) }
          });
          logger.info('[RecommendationWorker][notification:done] Ready notification sent', {
            jobId,
            userId: jobRecord.userId
          });
        } catch (notifError) {
          // Push notification failure must NOT fail the job
          logger.warn('[RecommendationWorker][notification:failed] Ready notification failed', {
            jobId,
            userId: jobRecord.userId,
            error: notifError
          });
        }

        logger.info('[RecommendationWorker][job:done] Recommendation job completed successfully', {
          jobId,
          durationMs: Date.now() - startedAt
        });
      } catch (error: any) {
        logger.error('[RecommendationWorker][job:failed] Internal worker error', {
          workerId: WORKER_ID,
          jobId,
          queueJobId: job.id,
          errorMessage: error.message,
          stack: error.stack
        });
        throw error; // Re-throw to let BullMQ handle the failure
      }
    },
    {
      connection: getBullMQConnection(),
      concurrency: 2
    }
  );

  worker.on('ready', () => {
    logger.info('[RecommendationWorker][bullmq:ready] Worker is ready to process jobs', {
      queueName: RECOMMENDATION_QUEUE_NAME
    });
  });

  worker.on('active', (job) => {
    const { jobId } = job.data as { jobId: number };
    logger.info('[RecommendationWorker][bullmq:active] Queue job started processing', {
      workerId: WORKER_ID,
      jobId,
      queueJobId: job.id
    });
  });

  worker.on('completed', (job) => {
    const { jobId } = job.data as { jobId: number };
    logger.info('[RecommendationWorker][bullmq:completed] Queue job completed successfully', {
      workerId: WORKER_ID,
      jobId,
      queueJobId: job.id
    });
  });

  worker.on('failed', async (job, err) => {
    const jobId = (job?.data as { jobId: number })?.jobId;
    logger.error('[RecommendationWorker][bullmq:failed] Queue job failed', {
      workerId: WORKER_ID,
      jobId,
      queueJobId: job?.id,
      errorMessage: err.message,
      stack: err.stack
    });

    if (jobId) {
      try {
        logger.info('[RecommendationWorker][db:status_failed:start] Marking job as FAILED', {
          jobId
        });
        await prisma.recommendation.update({
          where: { id: jobId },
          data: { status: RecommendationStatus.FAILED }
        });
        logger.info('[RecommendationWorker][db:status_failed:done] Job marked as FAILED', {
          jobId
        });
      } catch (dbErr) {
        logger.error('[RecommendationWorker][db:status_failed:failed] Failed to mark job FAILED', {
          jobId,
          error: dbErr
        });
      }
    }
  });

  worker.on('error', (err) => {
    logger.error('[RecommendationWorker][bullmq:error] Worker error', {
      errorMessage: err.message,
      stack: err.stack
    });
  });

  recommendationWorker = worker;

  logger.info(`[RecommendationWorker] Worker initialised and listening (ID: ${WORKER_ID})`);
};
