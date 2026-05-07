import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import cookingValidation from '../../validations/cooking.validation';
import cookingController from '../../controllers/cooking.controller';

const router = express.Router();

router
  .route('/')
  .post(auth(), validate(cookingValidation.createCooking), cookingController.createCooking)
  .get(auth(), validate(cookingValidation.getCookings), cookingController.getCookings);

router
  .route('/:cookingId')
  .get(auth(), validate(cookingValidation.getCookingById), cookingController.getCookingById);

router
  .route('/:cookingId/complete')
  .patch(auth(), validate(cookingValidation.completeCooking), cookingController.completeCooking);

router
  .route('/:cookingId/cancel')
  .patch(auth(), validate(cookingValidation.cancelCooking), cookingController.cancelCooking);

export default router;
