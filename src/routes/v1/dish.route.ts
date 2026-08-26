import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import dishValidation from '../../validations/dish.validation';
import dishController from '../../controllers/dish.controller';

const router = express.Router();

router
  .route('/')
  .post(auth('manageDishes'), validate(dishValidation.createDish), dishController.createDish)
  .get(validate(dishValidation.getDishes), dishController.getDishes);

router.route('/sync').get(auth(), validate(dishValidation.syncDishes), dishController.syncDishes);
router
  .route('/:dishId')
  .get(validate(dishValidation.getDishById), dishController.getDishById)
  .patch(auth('manageDishes'), validate(dishValidation.updateDish), dishController.updateDish)
  .delete(auth('manageDishes'), validate(dishValidation.deleteDish), dishController.deleteDish);
export default router;
