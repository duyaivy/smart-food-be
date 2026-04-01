import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
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

export default {
  uploadScan,
  streamScanResult
};
