import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import fridgeService from '../services/fridge.service';
import notificationService from '../services/notification.service';
import logger from '../config/logger';
import {
  CreateFridgeItemFromScanInput,
  CreateFridgeItemInput,
  GetFridgeItemsFilter,
  GetFridgeItemsOptions,
  GetFridgeTransactionsOptions,
  UpdateFridgeItemInput
} from '../models/interfaces/fridge.interface';

const createFridgeItem = catchAsync(
  async (req: Request<any, any, CreateFridgeItemInput, any>, res: Response) => {
    const userId = Number(req.userId);
    const item = await fridgeService.createFridgeItem(userId, req.body);

    notificationService
      .sendNotificationToUser(userId, {
        title: 'Đã thêm nguyên liệu vào tủ lạnh',
        body: `Nguyên liệu "${item.ingredient.name}" vừa được thêm vào tủ lạnh của bạn.`,
        data: {
          screen: 'Fridge',
          fridgeItemId: item.id,
          ingredientId: item.ingredientId,
          action: 'ADD'
        }
      })
      .catch((error) => {
        logger.error('Failed to send fridge add notification', error);
      });

    // fix: dùng res.status(CREATED) để trả đúng HTTP status code 201
    res.status(httpStatus.CREATED).send(
      successResponse({
        code: httpStatus.CREATED,
        message: 'Thêm nguyên liệu vào tủ lạnh thành công.',
        data: item
      })
    );
  }
);

const createFridgeItemFromScan = catchAsync(
  async (req: Request<any, any, CreateFridgeItemFromScanInput, any>, res: Response) => {
    const userId = Number(req.userId);
    const item = await fridgeService.createFridgeItemFromScan(userId, req.body);

    notificationService
      .sendNotificationToUser(userId, {
        title: 'Đã thêm nguyên liệu từ quét thiết bị',
        body: `Nguyên liệu "${item.ingredient.name}" vừa được thêm vào tủ lạnh từ kết quả quét.`,
        data: {
          screen: 'Fridge',
          fridgeItemId: item.id,
          ingredientId: item.ingredientId,
          action: 'ADD_FROM_SCAN'
        }
      })
      .catch((error) => {
        logger.error('Failed to send fridge add-from-scan notification', error);
      });

    res.status(httpStatus.CREATED).send(
      successResponse({
        code: httpStatus.CREATED,
        message: 'Thêm nguyên liệu từ kết quả quét thành công.',
        data: item
      })
    );
  }
);

const getFridgeItems = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { keyword, priority, isExpired, sortBy, sortOrder, limit, page } = req.query;

  const filter: GetFridgeItemsFilter = {
    ...(keyword ? { keyword: String(keyword) } : {}),
    ...(priority ? { priority: priority as GetFridgeItemsFilter['priority'] } : {}),
    ...(isExpired !== undefined ? { isExpired: isExpired as unknown as boolean } : {})
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

    notificationService
      .sendNotificationToUser(userId, {
        title: 'Đã cập nhật nguyên liệu trong tủ lạnh',
        body: `Nguyên liệu "${updatedItem.ingredient.name}" vừa được cập nhật.`,
        data: {
          screen: 'Fridge',
          fridgeItemId: updatedItem.id,
          ingredientId: updatedItem.ingredientId,
          action: 'UPDATE'
        }
      })
      .catch((error) => {
        logger.error('Failed to send fridge update notification', error);
      });

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

  notificationService
    .sendNotificationToUser(userId, {
      title: 'Đã xóa nguyên liệu khỏi tủ lạnh',
      body: `Nguyên liệu "${deletedItem.ingredient.name}" đã được xóa khỏi tủ lạnh.`,
      data: {
        screen: 'Fridge',
        fridgeItemId: deletedItem.id,
        ingredientId: deletedItem.ingredientId,
        action: 'DELETE'
      }
    })
    .catch((error) => {
      logger.error('Failed to send fridge delete notification', error);
    });

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
  createFridgeItemFromScan,
  getFridgeItems,
  getFridgeItemById,
  updateFridgeItem,
  deleteFridgeItem,
  getFridgeTransactions
};
