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
  IRecommendationJobResponse
} from '../models/interfaces/recommendation.interface';

// ─── Create ───────────────────────────────────────────────────────────────────

const createRecommendationJob = async (
  body: IRecommendationJobRequest,
  userId?: number
): Promise<{ jobId: number; status: string }> => {
  const workerInput = await recommendationInputHydrationService.hydrateWorkerInput(
    body,
    userId ?? 1
  );

  // 2. Persist job record in DB with PENDING status
  const job = await prisma.recommendation.create({
    data: {
      userId: userId ?? 1,
      status: RecommendationStatus.PENDING,
      input: workerInput as unknown as Prisma.InputJsonValue,
      output: Prisma.JsonNull
    }
  });

  // 3. Enqueue for async processing
  await enqueueRecommendationJob(job.id);

  return { jobId: job.id, status: RecommendationStatus.PENDING };
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
    input: job.input,
    output: (job.output ?? null) as IRecommendationJobResponse['output'],
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

export default {
  createRecommendationJob,
  getRecommendationJobById
};
