import httpStatus from 'http-status';
import { CookingStatus } from '@prisma/client';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import cookingService from '../services/cooking.service';
import {
  CookingSortBy,
  CreateCookingInput,
  GetCookingsFilter,
  GetCookingsOptions
} from '../models/interfaces/cooking.interface';

const createCooking = catchAsync(
  async (req: Request<any, any, CreateCookingInput, any>, res: Response) => {
    const userId = Number(req.userId);

    const cooking = await cookingService.createCooking(userId, req.body);

    res.status(httpStatus.CREATED).send(
      successResponse({
        code: httpStatus.CREATED,
        message: 'Bắt đầu nấu ăn thành công.',
        data: cooking
      })
    );
  }
);

const getCookings = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { status, sortBy, sortOrder, limit, page } = req.query;

  const filter: GetCookingsFilter = {
    ...(status
      ? {
          status: String(status)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean) as CookingStatus[]
        }
      : {})
  };

  const options: GetCookingsOptions = {
    ...(sortBy ? { sortBy: sortBy as CookingSortBy } : {}),
    ...(sortOrder ? { sortOrder: sortOrder as 'asc' | 'desc' } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
    ...(page ? { page: Number(page) } : {})
  };

  const result = await cookingService.getCookings(userId, filter, options);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy danh sách phiên nấu ăn thành công.',
      data: result
    })
  );
});

const getCookingById = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { cookingId } = req.params;

  const cooking = await cookingService.getCookingById(userId, Number(cookingId));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy chi tiết phiên nấu ăn thành công.',
      data: cooking
    })
  );
});

const completeCooking = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { cookingId } = req.params;

  const cooking = await cookingService.completeCooking(userId, Number(cookingId));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Hoàn thành phiên nấu ăn thành công.',
      data: cooking
    })
  );
});

const cancelCooking = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { cookingId } = req.params;

  const cooking = await cookingService.cancelCooking(userId, Number(cookingId));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Hủy phiên nấu ăn thành công.',
      data: cooking
    })
  );
});

export default {
  createCooking,
  getCookings,
  getCookingById,
  completeCooking,
  cancelCooking
};
