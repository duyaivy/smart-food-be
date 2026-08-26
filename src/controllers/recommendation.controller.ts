import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import recommendationService from '../services/recommendation.service';
import { IRecommendationJobRequest } from '../models/interfaces/recommendation.interface';

const createRecommendationJob = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as IRecommendationJobRequest;
  const result = await recommendationService.createRecommendationJob(body, req.userId);

  res.status(httpStatus.CREATED).send(
    successResponse({
      code: httpStatus.CREATED,
      message: 'Tạo job gợi ý thực đơn thành công',
      data: result
    })
  );
});

const getRecommendationJobById = catchAsync(async (req: Request, res: Response) => {
  const jobId = Number(req.params.jobId);
  const job = await recommendationService.getRecommendationJobById(jobId);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy thông tin job gợi ý thành công',
      data: job
    })
  );
});

const getAllRecommendations = catchAsync(async (req: Request, res: Response) => {
  const result = await recommendationService.getAllRecommendationJobs(req.userId as number);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy danh sách gợi ý thành công',
      data: result
    })
  );
});

const getSubRecommendations = catchAsync(async (req: Request, res: Response) => {
  const { jobId, dishIds } = req.body as {
    jobId: number;
    dishIds: number[];
  };

  const result = await recommendationService.getSubRecommendations(
    req.userId as number,
    dishIds,
    jobId
  );

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy danh sách món ăn thay thế thành công',
      data: result
    })
  );
});

const updateRecommendation = catchAsync(async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.jobId, 10);
  const { day, meal, swaps } = req.body as {
    day: number;
    meal: string;
    swaps: {
      originalDishId: number;
      dishId: number;
      role: string;
      missingIngredient: any[];
    }[];
  };

  const result = await recommendationService.updateRecommendation(req.userId as number, {
    jobId,
    day,
    meal,
    swaps
  });

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Thay thế món ăn thành công',
      data: result
    })
  );
});

export default {
  createRecommendationJob,
  getRecommendationJobById,
  getAllRecommendations,
  getSubRecommendations,
  updateRecommendation
};
