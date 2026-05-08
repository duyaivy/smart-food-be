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

export default {
  createRecommendationJob,
  getRecommendationJobById,
  getAllRecommendations
};
