import httpStatus from 'http-status';
import bcrypt from 'bcryptjs';
import prisma from '../../client';
import redis from '../../redis';
import ApiError from '../../utils/apiError';
import { getDeviceStatusCacheKey, ONLINE_THRESHOLD_MS } from './mqttPublisher.service';
import type {
  CachedDeviceStatus,
  DeviceStatusResponse,
  GetDeviceStatusInput,
  PairDeviceInput,
  PairDeviceResponse,
  UnpairDeviceInput,
  UnpairDeviceResponse
} from '../../models/types/iot.type';

const pairDevice = async (input: PairDeviceInput): Promise<PairDeviceResponse> => {
  const { userId, deviceUid, apiKey } = input;

  const device = await prisma.device.findUnique({
    where: {
      deviceUid
    }
  });

  if (!device) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Thiết bị không tồn tại');
  }

  const isValidApiKey = await bcrypt.compare(apiKey, device.apiKeyHash);

  if (!isValidApiKey) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Mã xác thực thiết bị không hợp lệ');
  }

  if (device.ownerId) {
    throw new ApiError(httpStatus.CONFLICT, 'Thiết bị đã được liên kết với tài khoản khác');
  }

  return prisma.device.update({
    where: {
      id: device.id
    },
    data: {
      ownerId: userId
    },
    select: {
      id: true,
      deviceUid: true,
      ownerId: true
    }
  });
};

const getMyDevices = async (userId: number) => {
  return prisma.device.findMany({
    where: {
      ownerId: userId
    },
    select: {
      id: true,
      deviceUid: true,
      ownerId: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
};

const getDeviceStatus = async (input: GetDeviceStatusInput): Promise<DeviceStatusResponse> => {
  const { userId, deviceUid } = input;

  const device = await prisma.device.findFirst({
    where: {
      deviceUid,
      ownerId: userId
    },
    select: {
      id: true,
      deviceUid: true
    }
  });

  if (!device) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy thiết bị thuộc tài khoản hiện tại');
  }

  if (!redis) {
    return {
      deviceUid,
      isOnline: false,
      batteryLevel: null,
      wifiSsid: null,
      signalStrength: null,
      lastSeenAt: null
    };
  }

  const cachedRaw = await redis.get(getDeviceStatusCacheKey(deviceUid));

  if (!cachedRaw) {
    return {
      deviceUid,
      isOnline: false,
      batteryLevel: null,
      wifiSsid: null,
      signalStrength: null,
      lastSeenAt: null
    };
  }

  const cachedStatus = JSON.parse(cachedRaw) as CachedDeviceStatus;
  const lastSeenAtMs = new Date(cachedStatus.lastSeenAt).getTime();
  const isOnline = Date.now() - lastSeenAtMs <= ONLINE_THRESHOLD_MS;

  return {
    deviceUid: cachedStatus.deviceUid,
    isOnline,
    batteryLevel: cachedStatus.batteryLevel,
    wifiSsid: cachedStatus.wifiSsid,
    signalStrength: cachedStatus.signalStrength,
    lastSeenAt: cachedStatus.lastSeenAt
  };
};

const unpairDevice = async (input: UnpairDeviceInput): Promise<UnpairDeviceResponse> => {
  const { userId, deviceUid } = input;

  const device = await prisma.device.findFirst({
    where: {
      deviceUid,
      ownerId: userId
    }
  });

  if (!device) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy thiết bị thuộc tài khoản hiện tại');
  }

  return prisma.device.update({
    where: {
      id: device.id
    },
    data: {
      ownerId: null
    },
    select: {
      id: true,
      deviceUid: true,
      ownerId: true
    }
  });
};

export default {
  pairDevice,
  getMyDevices,
  getDeviceStatus,
  unpairDevice
};
