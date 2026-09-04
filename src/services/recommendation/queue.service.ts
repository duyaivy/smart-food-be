import { Queue, Worker, ConnectionOptions } from 'bullmq';
import redis from '../../redis';
import logger from '../../config/logger';
import { RECOMMENDATION_QUEUE_NAME } from '../../constants/cache.constants';
import {
  createRecommendationJobProcessor,
  createRecommendationJobFailedHandler,
  RecommendationGenerateFn
} from './worker.service';

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

/**
 * Initialise the BullMQ worker. The AI-generation function is injected so this
 * module owns no generation logic and no circular dependency is introduced.
 */
export const initRecommendationWorker = (
  generateRecommendation: RecommendationGenerateFn
): void => {
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
    createRecommendationJobProcessor(generateRecommendation, WORKER_ID),
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

  worker.on('failed', createRecommendationJobFailedHandler(WORKER_ID));

  worker.on('error', (err) => {
    logger.error('[RecommendationWorker][bullmq:error] Worker error', {
      errorMessage: err.message,
      stack: err.stack
    });
  });

  recommendationWorker = worker;

  logger.info(`[RecommendationWorker] Worker initialised and listening (ID: ${WORKER_ID})`);
};
