import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import mealValidation from '../../validations/meal.validation';
import mealController from '../../controllers/meal.controller';

const router = express.Router();

router.route('/').post(auth(), validate(mealValidation.createMeal), mealController.createMeal);

router
  .route('/history')
  .get(auth(), validate(mealValidation.getMealHistory), mealController.getMealHistory);

router
  .route('/history/:mealLogId')
  .get(auth(), validate(mealValidation.getMealHistoryById), mealController.getMealHistoryById);

export default router;
