import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import categoryService from '../services/category.service';

const getCategories = catchAsync(async (_req: Request, res: Response) => {
  const categories = await categoryService.getCategories();
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy danh sách danh mục thành công',
      data: categories
    })
  );
});

const getCategoryById = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.getCategoryByIdOrThrow(Number(req.params.id));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy thông tin danh mục thành công',
      data: category
    })
  );
});

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body);
  res.status(httpStatus.CREATED).send(
    successResponse({
      code: httpStatus.CREATED,
      message: 'Tạo danh mục thành công',
      data: category
    })
  );
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  // Explicitly extract only allowed fields, ignoring isDeleted if provided in the body
  const { name, description } = req.body;
  const category = await categoryService.updateCategory(Number(req.params.id), {
    name,
    description
  });

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Cập nhật danh mục thành công',
      data: category
    })
  );
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(Number(req.params.id));
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Xóa danh mục thành công'
    })
  );
});

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
