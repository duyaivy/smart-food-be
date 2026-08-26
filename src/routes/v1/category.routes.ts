import express from 'express';
import validate from '../../middlewares/validate';
import categoryController from '../../controllers/category.controller';
import categoryValidations from '../../validations/category.validation';
import auth from '../../middlewares/auth';
const router = express.Router();

router
  .route('/')
  .get(categoryController.getCategories)
  .post(
    auth('manageCategories'),
    validate(categoryValidations.createCategory),
    categoryController.createCategory
  );

router
  .route('/:id')
  .get(validate(categoryValidations.getDetailCategory), categoryController.getCategoryById)
  .patch(
    auth('manageCategories'),
    validate(categoryValidations.updateCategory),
    categoryController.updateCategory
  )
  .delete(
    auth('manageCategories'),
    validate(categoryValidations.getDetailCategory),
    categoryController.deleteCategory
  );

export default router;
