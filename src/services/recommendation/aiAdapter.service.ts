import config from '../../config/config';
import logger from '../../config/logger';
import apiClient from '../../config/axios';
import {
  IRecommendationOutput,
  IRecommendationWorkerInput
} from '../../models/interfaces/recommendation.interface';
import { RECOMMENDATION_OUTPUT_TEMPLATE } from './mockData';

/**
 * Shared log context builder for worker inputs. Used by the AI adapter,
 * the job service (post-hydration) and the worker processor so all logs
 * describe the input in the same shape.
 */
export const getWorkerInputLogContext = (workerInput: IRecommendationWorkerInput) => ({
  userId: workerInput.userId,
  planDays: workerInput.planDays,
  startDate: workerInput.startDate,
  lockedPicksCount: workerInput.lockedPicks?.length ?? 0,
  fridgeItemsCount: workerInput.fridge.length,
  recentMealLogCount: workerInput.recentMealLog.length,
  mealTypes: Object.keys(workerInput.mealStructure)
});

/**
 * Backoff before the single retry of the external API call. The free-tier
 * recommendation host (Render) often cold-starts, so a second attempt after
 * a short wait frequently succeeds without changing the fallback semantics.
 */
const RETRY_BACKOFF_MS = 5000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One attempt against the external recommendation API. Uses the configurable
 * per-attempt timeout and disables the shared client's global axios-retry so
 * the adapter owns the policy: exactly 2 attempts (initial + 1 retry).
 */
const callExternalApi = (workerInput: IRecommendationWorkerInput) =>
  apiClient.post(config.recommendation.url, workerInput, {
    timeout: config.recommendation.apiTimeoutMs,
    'axios-retry': { retries: 0 }
  });

/**
 * Generate a recommendation output by choosing the mock vs the real provider.
 * Owning only the provider-selection responsibility keeps this adapter small
 * and open for adding new providers without touching the job/queue flow.
 */
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
    timeoutMs: config.recommendation.apiTimeoutMs,
    ...getWorkerInputLogContext(workerInput)
  });
  try {
    let response;
    try {
      response = await callExternalApi(workerInput);
    } catch (firstError: unknown) {
      const firstApiError = firstError as {
        response?: { status?: number };
        message?: string;
      };
      logger.warn(
        '[RecommendationService][generate:api:retry] First attempt failed, retrying once',
        {
          url: config.recommendation.url,
          durationMs: Date.now() - startedAt,
          statusCode: firstApiError.response?.status,
          errorMessage: firstApiError.message,
          retryInMs: RETRY_BACKOFF_MS
        }
      );
      await sleep(RETRY_BACKOFF_MS);
      response = await callExternalApi(workerInput);
    }

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
  } catch (error: unknown) {
    const apiError = error as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
    };
    const errorMessage = apiError.response?.data?.message || apiError.message || 'Unknown error';
    logger.error(
      '[RecommendationService][generate:api:failed] External recommendation API failed',
      {
        url: config.recommendation.url,
        durationMs: Date.now() - startedAt,
        statusCode: apiError.response?.status,
        errorMessage,
        responseData: apiError.response?.data
      }
    );
    logger.info(
      '[RecommendationService][generate:fallback] Falling back to MOCK data due to API error'
    );
    return RECOMMENDATION_OUTPUT_TEMPLATE as unknown as IRecommendationOutput;
  }
};

export default { generateRecommendation };
