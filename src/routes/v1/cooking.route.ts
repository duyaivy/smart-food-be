import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import cookingValidation from '../../validations/cooking.validation';
import cookingController from '../../controllers/cooking.controller';

const router = express.Router();

router
  .route('/')
  .post(auth(), validate(cookingValidation.createCooking), cookingController.createCooking);

router
  .route('/dishes/:dishId/preview')
  .get(auth(), validate(cookingValidation.getCookingPreview), cookingController.getCookingPreview);

router
  .route('/history')
  .get(auth(), validate(cookingValidation.getCookingHistory), cookingController.getCookingHistory);

router
  .route('/history/:mealLogId')
  .get(
    auth(),
    validate(cookingValidation.getCookingHistoryById),
    cookingController.getCookingHistoryById
  );

export default router;
