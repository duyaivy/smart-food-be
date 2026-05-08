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
  await queue.add('process', { jobId });
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

      await prisma.recommendation.update({
        where: { id: jobId },
        data: { status: RecommendationStatus.PROCESSING }
      });

      const jobRecord = await prisma.recommendation.findUnique({
        where: { id: jobId }
      });

      if (!jobRecord) {
        throw new Error(`[RecommendationWorker] Job ${jobId} not found in DB`);
      }

      const workerInput = jobRecord.input as unknown as IRecommendationWorkerInput;

      // 3. Generate recommendation (mock or real API)
      const output = await recommendationService.generateRecommendation(workerInput);

      // 4. Update DB with SUCCESS + output
      await prisma.recommendation.update({
        where: { id: jobId },
        data: {
          status: output.status || RecommendationStatus.FAILED,
          output: output as unknown as Prisma.InputJsonValue,
          message: output.message ?? ''
        }
      });

      // 5. Cache in Redis for 7 days
      if (redis) {
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
        await redis.set(
          RECOMMENDATION_JOB_CACHE_KEY(jobId),
          JSON.stringify(cacheData),
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

  worker.on('active', (job) => {
    const { jobId } = job.data as { jobId: number };
    logger.info(`[RecommendationWorker] Job ${job.id} (jobId=${jobId}) started processing`);
  });

  worker.on('completed', (job) => {
    const { jobId } = job.data as { jobId: number };
    logger.info(`[RecommendationWorker] Job ${job.id} (jobId=${jobId}) completed successfully`);
  });

  worker.on('failed', async (job, err) => {
    const jobId = (job?.data as { jobId: number })?.jobId;
    logger.error(`[RecommendationWorker] Job ${job?.id} (jobId=${jobId}) failed: ${err.message}`);

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
