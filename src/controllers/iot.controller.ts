import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import ApiError from '../utils/ApiError';
import { successResponse } from '../utils/response';
import iotService from '../services/iot.service';

const uploadScan = catchAsync(async (req: Request, res: Response) => {
  const { weight, deviceUid } = req.body;

  const result = await iotService.handleScanUpload({
    file: req.file,
    weight: Number(weight),
    deviceUid
  });

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Nhận dữ liệu quét từ thiết bị thành công',
      data: result
    })
  );
});

const streamScanResult = catchAsync(async (req: Request, res: Response) => {
  const { deviceUid } = req.params;

  iotService.openScanResultStream(deviceUid, res);
});

const pairDevice = catchAsync(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Vui lòng đăng nhập để thực hiện thao tác này');
  }

  const { deviceUid, apiKey } = req.body;

  const result = await iotService.pairDevice({
    userId,
    deviceUid,
    apiKey
  });

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Liên kết thiết bị thành công',
      data: result
    })
  );
});

const getMyDevices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Vui lòng đăng nhập để thực hiện thao tác này');
  }

  const result = await iotService.getMyDevices(userId);

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy danh sách thiết bị thành công',
      data: result
    })
  );
});

const getDeviceStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Vui lòng đăng nhập để thực hiện thao tác này');
  }

  const { deviceUid } = req.params;

  const result = await iotService.getDeviceStatus({
    userId,
    deviceUid
  });

  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy trạng thái thiết bị thành công',
      data: result
    })
  );
});

export default {
  uploadScan,
  streamScanResult,
  pairDevice,
  getMyDevices,
  getDeviceStatus
};
