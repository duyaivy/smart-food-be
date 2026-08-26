import httpStatus from 'http-status';
import pick from '../utils/pick';
import ApiError from '../utils/apiError';
import catchAsync from '../utils/catchAsync';
import { userService } from '../services';
import { successResponse } from '../utils/response';
import { Request, Response } from 'express';
import notificationService from '../services/notification.service';

const createUser = catchAsync(async (req, res) => {
  const { email, password, name, role, avatar, height, weight, sex, birthday } = req.body;
  const user = await userService.createUser({
    email,
    password,
    name,
    role,
    avatar: avatar ?? null,
    height: height ?? null,
    weight: weight ?? null,
    sex: sex ?? null,
    birthday: birthday ?? null
  });
  res.status(httpStatus.CREATED).send(user);
});

const getUsers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

const getUser = catchAsync(async (req, res) => {
  const user = await userService.getUserById(Number(req.params.userId));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send(user);
});

const updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUserById(Number(req.params.userId), req.body);
  res.send(user);
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(Number(req.params.userId));
  res.status(httpStatus.NO_CONTENT).send();
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getMe(req.userId as number);
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Lấy thông tin người dùng thành công',
      data: user
    })
  );
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateMe(req.userId as number, req.body);
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Cập nhật thông tin người dùng thành công',
      data: user
    })
  );
});

const createPushToken = catchAsync(async (req: Request, res: Response) => {
  const { token, deviceName } = req.body;
  await userService.createPushToken(req.userId as number, token, deviceName);
  res.send(
    successResponse({
      code: httpStatus.CREATED,
      message: 'Lưu token thành công'
    })
  );
});

const sendTestNotification = catchAsync(async (req: Request, res: Response) => {
  const { title, message, data } = req.body;
  await notificationService.sendNotificationToAllUsers(title, message, data);
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Gửi thông báo thành công',
      data: {
        title,
        message,
        data
      }
    })
  );
});
const clearCache = catchAsync(async (req: Request, res: Response) => {
  await userService.clearGlobalCache();
  res.send(
    successResponse({
      code: httpStatus.OK,
      message: 'Xóa cache thành công'
    })
  );
});

export default {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getMe,
  updateMe,
  createPushToken,
  sendTestNotification,
  clearCache
};
