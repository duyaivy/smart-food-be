import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import fridgeValidation from '../../validations/fridge.validation';
import fridgeController from '../../controllers/fridge.controller';

const router = express.Router();

router
  .route('/items')
  .post(auth(), validate(fridgeValidation.createFridgeItem), fridgeController.createFridgeItem)
  .get(auth(), validate(fridgeValidation.getFridgeItems), fridgeController.getFridgeItems);

router
  .route('/items/:itemId')
  .get(auth(), validate(fridgeValidation.getFridgeItemById), fridgeController.getFridgeItemById)
  .patch(auth(), validate(fridgeValidation.updateFridgeItem), fridgeController.updateFridgeItem)
  .delete(auth(), validate(fridgeValidation.deleteFridgeItem), fridgeController.deleteFridgeItem);

router
  .route('/transactions')
  .get(
    auth(),
    validate(fridgeValidation.getFridgeTransactions),
    fridgeController.getFridgeTransactions
  );

export default router;
