import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import recommendationValidations from '../../validations/recommendation.validation';
import recommendationController from '../../controllers/recommendation.controller';

const router = express.Router();

router
  .route('/')
  .post(
    auth(),
    validate(recommendationValidations.createRecommendationJob),
    recommendationController.createRecommendationJob
  )
  .get(auth(), recommendationController.getAllRecommendations);

router
  .route('/:jobId')
  .get(
    auth(),
    validate(recommendationValidations.getRecommendationJob),
    recommendationController.getRecommendationJobById
  );

export default router;
