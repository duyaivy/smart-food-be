import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import cookingService from '../services/cooking.service';
import {
  CookingHistorySortBy,
  CreateCookingInput,
  GetCookingHistoryFilter,
  GetCookingHistoryOptions
} from '../models/interfaces/cooking.interface';

const getCookingPreview = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { dishId } = req.params;

  const result = await cookingService.getCookingPreview(userId, Number(dishId));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy thông tin chuẩn bị nấu ăn thành công.',
      data: result
    })
  );
});

const createCooking = catchAsync(
  async (req: Request<any, any, CreateCookingInput, any>, res: Response) => {
    const userId = Number(req.userId);

    const result = await cookingService.createCooking(userId, req.body);

    res.status(httpStatus.CREATED).send(
      successResponse({
        code: httpStatus.CREATED,
        message: 'Ghi nhận nấu ăn thành công.',
        data: result
      })
    );
  }
);

const getCookingHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { dishId, fromDate, toDate, sortBy, sortOrder, limit, page } = req.query;

  const filter: GetCookingHistoryFilter = {
    ...(dishId ? { dishId: Number(dishId) } : {}),
    ...(fromDate ? { fromDate: new Date(String(fromDate)) } : {}),
    ...(toDate ? { toDate: new Date(String(toDate)) } : {})
  };

  const options: GetCookingHistoryOptions = {
    ...(sortBy ? { sortBy: sortBy as CookingHistorySortBy } : {}),
    ...(sortOrder ? { sortOrder: sortOrder as 'asc' | 'desc' } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
    ...(page ? { page: Number(page) } : {})
  };

  const result = await cookingService.getCookingHistory(userId, filter, options);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy lịch sử nấu ăn thành công.',
      data: result
    })
  );
});

const getCookingHistoryById = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { mealLogId } = req.params;

  const result = await cookingService.getCookingHistoryById(userId, Number(mealLogId));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy chi tiết lịch sử nấu ăn thành công.',
      data: result
    })
  );
});

export default {
  getCookingPreview,
  createCooking,
  getCookingHistory,
  getCookingHistoryById
};
