import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import nutritionValidation from '../../validations/nutrition.validation';
import nutritionController from '../../controllers/nutrition.controller';

const router = express.Router();

router
  .route('/daily')
  .get(
    auth(),
    validate(nutritionValidation.getDailyNutrition),
    nutritionController.getDailyNutrition
  );

router
  .route('/weekly')
  .get(
    auth(),
    validate(nutritionValidation.getWeeklyNutrition),
    nutritionController.getWeeklyNutrition
  );

router
  .route('/daily/remaining')
  .get(
    auth(),
    validate(nutritionValidation.getDailyRemainingNutrition),
    nutritionController.getDailyRemainingNutrition
  );

export default router;
