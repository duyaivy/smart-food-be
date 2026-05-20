import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import nutritionService from '../services/nutrition.service';

const getDailyNutrition = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { date } = req.query;

  const result = await nutritionService.getDailyNutrition(userId, String(date));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy thông tin dinh dưỡng theo ngày thành công.',
      data: result
    })
  );
});

const getWeeklyNutrition = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { week } = req.query;

  const result = await nutritionService.getWeeklyNutrition(userId, String(week));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy thông tin dinh dưỡng theo tuần thành công.',
      data: result
    })
  );
});

const getDailyRemainingNutrition = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.userId);
  const { date } = req.query;

  const result = await nutritionService.getDailyRemainingNutrition(userId, String(date));

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy lượng dinh dưỡng còn lại trong ngày thành công.',
      data: result
    })
  );
});

export default {
  getDailyNutrition,
  getWeeklyNutrition,
  getDailyRemainingNutrition
};
