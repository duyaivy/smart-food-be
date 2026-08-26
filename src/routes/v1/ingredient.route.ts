import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import ingredientValidation from '../../validations/ingredient.validation';
import ingredientController from '../../controllers/ingredient.controller';
const router = express.Router();

router
  .route('/')
  .post(
    auth('manageIngredients'),
    validate(ingredientValidation.createIngredient),
    ingredientController.createIngredient
  )
  .get(validate(ingredientValidation.getIngredients), ingredientController.getIngredients);

router
  .route('/sync')
  .get(
    auth(),
    validate(ingredientValidation.syncIngredients),
    ingredientController.syncIngredients
  );
router
  .route('/:ingredientId')
  .get(validate(ingredientValidation.getIngredientById), ingredientController.getIngredientById)
  .patch(
    auth('manageIngredients'),
    validate(ingredientValidation.updateIngredient),
    ingredientController.updateIngredient
  )
  .delete(
    auth('manageIngredients'),
    validate(ingredientValidation.deleteIngredient),
    ingredientController.deleteIngredient
  );
export default router;
