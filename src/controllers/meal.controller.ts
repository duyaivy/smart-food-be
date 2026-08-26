import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import mealService from '../services/meal.service';
import {
  MealHistorySortBy,
  CreateMealInput,
  GetMealHistoryFilter,
  GetMealHistoryOptions
} from '../models/interfaces/meal.interface';

const createMeal = catchAsync(
  async (req: Request<any, any, CreateMealInput, any>, res: Response) => {
    const userId = Number(req.userId);

    const result = await mealService.createMeal(userId, req.body);

    res.status(httpStatus.CREATED).send(
      successResponse({
        code: httpStatus.CREATED,
        message: 'Ghi nhận bữa ăn thành công.',
        data: result
      })
    );
  }
);

const getMealHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { dishId, fromDate, toDate, sortBy, sortOrder, limit, page } = req.query;

  const filter: GetMealHistoryFilter = {
    ...(dishId ? { dishId: Number(dishId) } : {}),
    ...(fromDate ? { fromDate: new Date(String(fromDate)) } : {}),
    ...(toDate ? { toDate: new Date(String(toDate)) } : {})
  };

  const options: GetMealHistoryOptions = {
    ...(sortBy ? { sortBy: sortBy as MealHistorySortBy } : {}),
    ...(sortOrder ? { sortOrder: sortOrder as 'asc' | 'desc' } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
    ...(page ? { page: Number(page) } : {})
  };

  const result = await mealService.getMealHistory(userId, filter, options);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy lịch sử bữa ăn thành công.',
      data: result
    })
  );
});

const getMealHistoryById = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { mealLogId } = req.params;

  const result = await mealService.getMealHistoryById(userId, Number(mealLogId));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy chi tiết lịch sử bữa ăn thành công.',
      data: result
    })
  );
});

export default {
  createMeal,
  getMealHistory,
  getMealHistoryById
};
