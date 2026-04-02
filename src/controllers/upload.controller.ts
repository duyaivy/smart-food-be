import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';
import catchAsync from '../utils/catchAsync';
import { successResponse } from '../utils/response';
import { Request, Response } from 'express';
import uploadService from '../services/upload.service';

const uploadMedia = catchAsync(async (req: Request, res: Response) => {
  const { file } = req;
  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Không có tệp nào được tải lên');
  }

  const uploadedFile: { secure_url?: string } = (await uploadService.uploadToCloudinary(
    file,
    'smart-food'
  )) as { secure_url?: string };

  res.send(
    successResponse({
      code: httpStatus.OK,
      data: uploadedFile?.secure_url ?? '',
      message: 'Tải tệp lên Cloudinary thành công'
    })
  );
});
const uploadAvatar = catchAsync(async (req: Request, res: Response) => {
  const { file } = req;
  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Không có tệp nào được tải lên');
  }

  const uploadedFile: { public_id?: string } = (await uploadService.uploadToCloudinary(
    file,
    'smart-food/avatars'
  )) as { public_id?: string };

  const avatarUrl = uploadService.createAvatarUrl(
    uploadedFile.public_id ?? '',
    'rgb:F8F3F0',
    'rgb:ffffff'
  );
  res.send(
    successResponse({
      code: httpStatus.OK,
      data: avatarUrl,
      message: 'Tải ảnh đại diện lên Cloudinary thành công'
    })
  );
});
export default {
  uploadMedia,
  uploadAvatar
};
