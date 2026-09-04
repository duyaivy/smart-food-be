import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import { Request, Response } from 'express';
import ingredientService from '../services/ingredient/ingredient.service';
import { CreateIngredientInput } from '../models/interfaces/ingredient.interface';

const createIngredient = catchAsync(
  async (req: Request<any, any, CreateIngredientInput, any>, res: Response) => {
    const ingredient = await ingredientService.createIngredient(req.body);

    res.send(
      successResponse({
        code: httpStatus.CREATED,
        message: 'Tạo mới nguyên liệu thành công.',
        data: ingredient
      })
    );
  }
);
const getIngredients = catchAsync(async (req: Request, res: Response) => {
  const { name, categoryId, sortBy, limit, page } = req.query;
  const filter = {
    ...(name ? { name: String(name) } : {}),
    ...(categoryId ? { categoryId: Number(categoryId) } : {})
  };
  const options = {
    ...(sortBy ? { sortBy: String(sortBy) } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
    ...(page ? { page: Number(page) } : {})
  };
  const result = await ingredientService.getIngredients(filter, options);
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy danh sách nguyên liệu thành công.',
      data: result
    })
  );
});
const getIngredientById = catchAsync(async (req: Request, res: Response) => {
  const { ingredientId } = req.params;
  const ingredient = await ingredientService.getIngredientById(Number(ingredientId));
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy thông tin nguyên liệu thành công.',
      data: ingredient
    })
  );
});
const updateIngredient = catchAsync(async (req: Request, res: Response) => {
  const { ingredientId } = req.params;
  const updatedIngredient = await ingredientService.updateIngredient(
    Number(ingredientId),
    req.body
  );

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Cập nhật nguyên liệu thành công.',
      data: updatedIngredient
    })
  );
});
const deleteIngredient = catchAsync(async (req: Request, res: Response) => {
  const { ingredientId } = req.params;
  await ingredientService.deleteIngredient(Number(ingredientId));

  res.send(
    successResponse({
      code: httpStatus.NO_CONTENT,
      message: 'Xóa nguyên liệu thành công.'
    })
  );
});
const syncIngredients = catchAsync(async (req: Request, res: Response) => {
  const { lastSyncAt } = req.query;
  const ingredients = await ingredientService.syncIngredients(
    lastSyncAt ? new Date(lastSyncAt as string) : undefined
  );
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Đồng bộ nguyên liệu thành công.',
      data: ingredients
    })
  );
});
export default {
  createIngredient,
  getIngredients,
  getIngredientById,
  updateIngredient,
  deleteIngredient,
  syncIngredients
};
