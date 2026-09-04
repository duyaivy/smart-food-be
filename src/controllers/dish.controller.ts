import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import { Request, Response } from 'express';
import { CreateDishInput, Difficulty, DishSortBy } from '../models/interfaces/dish.interface';
import dishService from '../services/dish.service';

const createDish = catchAsync(
  async (req: Request<any, any, CreateDishInput, any>, res: Response) => {
    const dish = await dishService.createDish(req.body);

    res.status(httpStatus.CREATED).send(
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
    ...(sortBy ? { sortBy: String(sortBy) as DishSortBy } : {}),
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

  res.send(
    successResponse({
      code: httpStatus.OK,
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
