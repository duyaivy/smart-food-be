import recommendationJobService from './recommendation.job.service';
import recommendationAiAdapterService from './recommendation.aiAdapter.service';
import recommendationSubService from './recommendation.sub.service';

/**
 * Thin facade re-exporting the split recommendation services.
 *
 * Keeps the public surface (`recommendationService`) used by the controller
 * and any other call sites stable while the actual responsibilities live in
 * focused files: job lifecycle (DB + cache), AI adapter (mock/real provider),
 * replacement-dish search, and nutrition/shopping-list helpers.
 */
export default {
  createRecommendationJob: recommendationJobService.createRecommendationJob,
  getAllRecommendationJobs: recommendationJobService.getAllRecommendationJobs,
  getRecommendationJobById: recommendationJobService.getRecommendationJobById,
  generateRecommendation: recommendationAiAdapterService.generateRecommendation,
  getSubRecommendations: recommendationSubService.getSubRecommendations,
  updateRecommendation: recommendationJobService.updateRecommendation
};
