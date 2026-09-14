import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import fridgeService from '../services/fridge/fridge.service';
import {
  CreateFridgeItemInput,
  GetFridgeItemsFilter,
  GetFridgeItemsOptions,
  GetFridgeTransactionsOptions,
  UpdateFridgeItemInput
} from '../models/interfaces/fridge.interface';

const normalizeBooleanQuery = (value: unknown): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
};

const createFridgeItem = catchAsync(
  async (req: Request<any, any, CreateFridgeItemInput, any>, res: Response) => {
    const userId = Number(req.userId);
    const item = await fridgeService.createFridgeItem(userId, req.body);

    res.status(httpStatus.CREATED).send(
      successResponse({
        code: httpStatus.CREATED,
        message: 'Thêm nguyên liệu vào tủ lạnh thành công.',
        data: item
      })
    );
  }
);

const getFridgeItems = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { keyword, priority, isExpired, sortBy, sortOrder, limit, page } = req.query;
  const normalizedIsExpired = normalizeBooleanQuery(isExpired);

  const filter: GetFridgeItemsFilter = {
    ...(keyword ? { keyword: String(keyword) } : {}),
    ...(priority ? { priority: priority as GetFridgeItemsFilter['priority'] } : {}),
    ...(normalizedIsExpired !== undefined ? { isExpired: normalizedIsExpired } : {})
  };

  const options: GetFridgeItemsOptions = {
    ...(sortBy ? { sortBy: sortBy as GetFridgeItemsOptions['sortBy'] } : {}),
    ...(sortOrder ? { sortOrder: sortOrder as GetFridgeItemsOptions['sortOrder'] } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
    ...(page ? { page: Number(page) } : {})
  };

  const result = await fridgeService.getFridgeItems(userId, filter, options);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy danh sách nguyên liệu trong tủ lạnh thành công.',
      data: result
    })
  );
});

const getFridgeItemById = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { itemId } = req.params;

  const item = await fridgeService.getFridgeItemById(userId, Number(itemId));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy chi tiết nguyên liệu trong tủ lạnh thành công.',
      data: item
    })
  );
});

const updateFridgeItem = catchAsync(
  async (req: Request<any, any, UpdateFridgeItemInput, any>, res: Response) => {
    const userId = Number(req.userId);
    const { itemId } = req.params;

    const updatedItem = await fridgeService.updateFridgeItem(userId, Number(itemId), req.body);

    res.send(
      successResponse({
        code: httpStatus.OK,
        message: 'Cập nhật nguyên liệu trong tủ lạnh thành công.',
        data: updatedItem
      })
    );
  }
);

const deleteFridgeItem = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { itemId } = req.params;

  const deletedItem = await fridgeService.deleteFridgeItem(userId, Number(itemId));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Xóa nguyên liệu khỏi tủ lạnh thành công.',
      data: deletedItem
    })
  );
});

const getFridgeTransactions = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { limit, page } = req.query;

  const options: GetFridgeTransactionsOptions = {
    ...(limit ? { limit: Number(limit) } : {}),
    ...(page ? { page: Number(page) } : {})
  };

  const result = await fridgeService.getFridgeTransactions(userId, options);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy lịch sử thao tác tủ lạnh thành công.',
      data: result
    })
  );
});

export default {
  createFridgeItem,
  getFridgeItems,
  getFridgeItemById,
  updateFridgeItem,
  deleteFridgeItem,
  getFridgeTransactions
};
