import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import { Request, Response } from 'express';
import { CreateDishInput, Difficulty } from '../models/interfaces/dish.interface';
import dishService from '../services/dish.service';
import notificationService from '../services/notification.service';
import logger from '../config/logger';

const createDish = catchAsync(
  async (req: Request<any, any, CreateDishInput, any>, res: Response) => {
    const dish = await dishService.createDish(req.body);

    notificationService
      .sendNotificationToAllUsers(
        'Món ăn mới!',
        `Món "${dish.name}" vừa được thêm vào thực đơn. Khám phá ngay!`,
        { screen: 'DishDetail', dishId: dish.id, action: 'CREATE' }
      )
      .catch((error) => {
        logger.error('Failed to send notification to all users', error);
      });

    res.send(
      successResponse({
        code: httpStatus.CREATED,
        message: 'Tạo mới món ăn thành công.',
        data: dish
      })
    );
  }
);
const getDishes = catchAsync(async (req: Request, res: Response) => {
  const { name, difficulty, sortBy, limit, page } = req.query;
  const filter = {
    ...(name ? { name: String(name) } : {}),
    ...(difficulty ? { difficulty: String(difficulty) as Difficulty } : {})
  };
  const options = {
    ...(sortBy ? { sortBy: String(sortBy) } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
    ...(page ? { page: Number(page) } : {})
  };
  const result = await dishService.getDishes(filter, options);
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy danh sách món ăn thành công.',
      data: result
    })
  );
});
const getDishById = catchAsync(async (req: Request, res: Response) => {
  const { dishId } = req.params;
  const dish = await dishService.getDishById(Number(dishId));
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy thông tin món ăn thành công.',
      data: dish
    })
  );
});
const updateDish = catchAsync(async (req: Request, res: Response) => {
  const { dishId } = req.params;
  const updatedDish = await dishService.updateDish(Number(dishId), req.body);

  notificationService
    .sendNotificationToAllUsers('', '', {
      screen: 'DishDetail',
      dishId: Number(dishId),
      action: 'UPDATE'
    })
    .catch((error) => {
      logger.error('Failed to send notification to all users', error);
    });

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Cập nhật món ăn thành công.',
      data: updatedDish
    })
  );
});
const deleteDish = catchAsync(async (req: Request, res: Response) => {
  const { dishId } = req.params;
  await dishService.deleteDish(Number(dishId));

  notificationService
    .sendNotificationToAllUsers('', '', {
      screen: 'DishDetail',
      dishId: Number(dishId),
      action: 'DELETE'
    })
    .catch((error) => {
      logger.error('Failed to send notification to all users', error);
    });

  res.send(
    successResponse({
      code: httpStatus.NO_CONTENT,
      message: 'Xóa món ăn thành công.'
    })
  );
});
const syncDishes = catchAsync(async (req: Request, res: Response) => {
  const { lastSyncAt } = req.query;
  const dishes = await dishService.syncDishes(
    lastSyncAt ? new Date(lastSyncAt as string) : undefined
  );
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Đồng bộ món ăn thành công.',
      data: dishes
    })
  );
});
export default {
  createDish,
  getDishes,
  getDishById,
  updateDish,
  deleteDish,
  syncDishes
};
