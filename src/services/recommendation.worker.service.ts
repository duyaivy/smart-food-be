import { Job } from 'bullmq';
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
import {
  IRecommendationOutput,
  IRecommendationWorkerInput
} from '../models/interfaces/recommendation.interface';
import { getWorkerInputLogContext } from './recommendation.aiAdapter.service';

export type RecommendationGenerateFn = (
  workerInput: IRecommendationWorkerInput
) => Promise<IRecommendationOutput>;

/**
 * Job processor for the recommendation worker.
 *
 * The AI-generation function is injected rather than imported so this module
 * (and the queue service that wires it) owns no AI logic and no circular
 * dependency exists with the recommendation service.
 */
export const createRecommendationJobProcessor = (
  generateRecommendation: RecommendationGenerateFn,
  workerId: string
) => {
  return async (job: Job): Promise<void> => {
    let jobId: number | undefined;
    try {
      const data = job.data as { jobId: number };
      jobId = data.jobId;

      if (!jobId) {
        logger.error('[RecommendationWorker][job:error] Job data missing jobId', {
          workerId,
          queueJobId: job.id,
          data: job.data
        });
        throw new Error('Missing jobId in job data');
      }

      const startedAt = Date.now();
      logger.info('[RecommendationWorker][job:start] Processing recommendation job', {
        workerId,
        jobId,
        queueJobId: job.id,
        queueName: RECOMMENDATION_QUEUE_NAME
      });

      logger.info('[RecommendationWorker][db:status_processing:start] Marking job as PROCESSING', {
        jobId
      });
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

      // 3. Generate recommendation (mock or real API) via injected function
      const generateStartedAt = Date.now();
      logger.info('[RecommendationWorker][recommendation_api:start] Generating recommendation', {
        jobId,
        ...getWorkerInputLogContext(workerInput)
      });
      const output = await generateRecommendation(workerInput);
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[RecommendationWorker][job:failed] Internal worker error', {
        workerId,
        jobId,
        queueJobId: job.id,
        errorMessage: err.message,
        stack: err.stack
      });
      throw err; // Re-throw to let BullMQ handle the failure
    }
  };
};

/**
 * Handler for the BullMQ `failed` event: best-effort DB status update to FAILED.
 * Kept separate from the queue wiring so the queue file only registers handlers.
 */
export const createRecommendationJobFailedHandler = (workerId: string) => {
  return async (job: Job | undefined, err: Error): Promise<void> => {
    const jobId = (job?.data as { jobId: number })?.jobId;
    logger.error('[RecommendationWorker][bullmq:failed] Queue job failed', {
      workerId,
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
  };
};
