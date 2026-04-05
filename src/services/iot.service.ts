import streamifier from 'streamifier';
import httpStatus from 'http-status';
import { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import bcrypt from 'bcryptjs';
import prisma from '../client';
import redis from '../redis';
import ApiError from '../utils/apiError';
import logger from '../config/logger';
import { mqttService } from './mqtt.service';
import ingredientClassifierService from './ingredientClassification.service';
import type {
  CachedDeviceStatus,
  DeviceHeartbeatPayload,
  DeviceStatusResponse,
  GetDeviceStatusInput,
  HandleScanUploadInput,
  PairDeviceInput,
  PairDeviceResponse,
  ScanHttpResponse,
  ScanMqttPayload,
  UnpairDeviceInput,
  UnpairDeviceResponse
} from '../types/iot.type';

const sseClients = new Map<string, Set<Response>>();
const HEARTBEAT_TOPIC = 'smart-food/device/+/status/heartbeat';
const HEARTBEAT_TTL_SECONDS = 180;
const ONLINE_THRESHOLD_MS = 90 * 1000;

const getResultTopic = (deviceUid: string) => {
  return `smart-food/device/${deviceUid}/scan/result`;
};

const getDeviceStatusCacheKey = (deviceUid: string) => {
  return `iot:device:status:${deviceUid}`;
};

const sanitizeFolderName = (value: string) => {
  const sanitized = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.+$/g, '');

  return sanitized || 'unknown';
};

type ScanTraceContext = {
  scanId: string;
  requestReceivedAtMs: number;
};

type ScanQueueJob = {
  fileBuffer: Buffer;
  weight: number;
  deviceUid: string;
  trace: ScanTraceContext;
  enqueuedAtMs: number;
};

const SCAN_QUEUE_CONCURRENCY = 1;
const scanJobQueue: ScanQueueJob[] = [];
let activeScanJobs = 0;

const publishSSE = (deviceUid: string, payload: ScanMqttPayload, trace: ScanTraceContext) => {
  const clients = sseClients.get(deviceUid);
  const clientCount = clients?.size || 0;

  logger.info('[SSE] publishScanResult', {
    scanId: trace.scanId,
    deviceUid,
    clientCount,
    payload
  });

  if (!clients) {
    logger.warn('[SSE] No active subscribers for scan-result', {
      deviceUid,
      scanId: trace.scanId
    });
    return;
  }

  const data = `event: scan-result\ndata: ${JSON.stringify(payload)}\n\n`;

  clients.forEach((client) => {
    client.write(data);
    client.flush?.();
  });
};

const uploadBufferToCloudinary = async (buffer: Buffer, folder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `smart-food/${folder}`,
        resource_type: 'image'
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Upload ảnh thất bại'));
          return;
        }

        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

const publishScanResult = async (payload: ScanMqttPayload, trace: ScanTraceContext) => {
  const topic = getResultTopic(payload.deviceUid);
  mqttService.publish(topic, payload);
  publishSSE(payload.deviceUid, payload, trace);
};

const executeScanJob = async (job: ScanQueueJob) => {
  const { fileBuffer, weight, deviceUid, trace, enqueuedAtMs } = job;
  const { scanId, requestReceivedAtMs } = trace;
  const processingStartedAtMs = Date.now();

  logger.info('[IOT][Queue] Job started', {
    scanId,
    deviceUid,
    queueWaitMs: processingStartedAtMs - enqueuedAtMs,
    queuedMs: processingStartedAtMs - requestReceivedAtMs,
    queueLength: scanJobQueue.length,
    activeScanJobs
  });

  try {
    const inferStartedAtMs = Date.now();
    const predictions = await ingredientClassifierService.predictFromBuffer(fileBuffer, 1);
    const bestPrediction = predictions[0];

    if (!bestPrediction) {
      throw new Error('Không có kết quả dự đoán từ model');
    }

    const inferDurationMs = Date.now() - inferStartedAtMs;

    logger.info('[IOT] Model dự đoán nguyên liệu thành công', {
      scanId,
      deviceUid,
      labelId: bestPrediction.labelId,
      label: bestPrediction.label,
      confidence: bestPrediction.confidence,
      inferDurationMs
    });

    const folderName = sanitizeFolderName(bestPrediction.label);

    const uploadStartedAtMs = Date.now();
    const imageUrl = await uploadBufferToCloudinary(fileBuffer, folderName);
    const uploadDurationMs = Date.now() - uploadStartedAtMs;

    logger.info('[IOT][Trace] Image upload completed', {
      scanId,
      deviceUid,
      folderName,
      uploadDurationMs
    });

    const ssePublishedAtMs = Date.now();
    const totalDurationMs = ssePublishedAtMs - requestReceivedAtMs;
    const processingDurationMs = ssePublishedAtMs - processingStartedAtMs;

    logger.info('[IOT][E2E] /iot/scan -> SSE publish', {
      deviceUid,
      scanId,
      processingDurationMs,
      totalDurationMs,
      totalDurationSec: Number((totalDurationMs / 1000).toFixed(3))
    });

    await publishScanResult(
      {
        deviceUid,
        ingredientName: bestPrediction.label,
        calories: null,
        weight,
        status: 'DONE',
        message: `Nhận diện nguyên liệu thành công (${Math.round(
          bestPrediction.confidence * 100
        )}%)`,
        imageUrl
      },
      trace
    );
  } catch (error) {
    logger.error('[IOT] Lỗi khi xử lý kết quả quét:', {
      scanId,
      deviceUid,
      error
    });

    let fallbackImageUrl = '';

    try {
      fallbackImageUrl = await uploadBufferToCloudinary(fileBuffer, 'unknown');
    } catch (uploadError) {
      logger.error('[IOT] Upload fallback unknown thất bại:', {
        scanId,
        deviceUid,
        uploadError
      });
    }

    const ssePublishedAtMs = Date.now();
    const totalDurationMs = ssePublishedAtMs - requestReceivedAtMs;
    const processingDurationMs = ssePublishedAtMs - processingStartedAtMs;

    logger.info('[IOT][E2E] /iot/scan -> SSE publish (failed)', {
      deviceUid,
      scanId,
      processingDurationMs,
      totalDurationMs,
      totalDurationSec: Number((totalDurationMs / 1000).toFixed(3))
    });

    await publishScanResult(
      {
        deviceUid,
        ingredientName: null,
        calories: null,
        weight,
        status: 'FAILED',
        message: 'Xử lý dữ liệu quét thất bại',
        imageUrl: fallbackImageUrl
      },
      trace
    );
  }
};

const processScanQueue = () => {
  while (activeScanJobs < SCAN_QUEUE_CONCURRENCY && scanJobQueue.length > 0) {
    const job = scanJobQueue.shift();

    if (!job) {
      return;
    }

    activeScanJobs += 1;

    void executeScanJob(job)
      .catch((error) => {
        logger.error('[IOT][Queue] Unexpected scan job execution error:', {
          scanId: job.trace.scanId,
          deviceUid: job.deviceUid,
          error
        });
      })
      .finally(() => {
        activeScanJobs -= 1;
        logger.info('[IOT][Queue] Job finished', {
          scanId: job.trace.scanId,
          deviceUid: job.deviceUid,
          queueLength: scanJobQueue.length,
          activeScanJobs
        });
        processScanQueue();
      });
  }
};

const enqueueScanJob = (job: ScanQueueJob) => {
  scanJobQueue.push(job);

  logger.info('[IOT][Queue] Job enqueued', {
    scanId: job.trace.scanId,
    deviceUid: job.deviceUid,
    queueLength: scanJobQueue.length,
    activeScanJobs,
    concurrency: SCAN_QUEUE_CONCURRENCY
  });

  processScanQueue();
};

const saveDeviceHeartbeat = async (payload: DeviceHeartbeatPayload) => {
  if (!redis) {
    logger.warn('[IOT] Redis chưa được cấu hình, bỏ qua lưu heartbeat');
    return;
  }

  const cachedStatus: CachedDeviceStatus = {
    deviceUid: payload.deviceUid,
    batteryLevel: payload.batteryLevel,
    wifiSsid: payload.wifiSsid,
    signalStrength: payload.signalStrength,
    lastSeenAt: payload.timestamp
  };

  await redis.set(
    getDeviceStatusCacheKey(payload.deviceUid),
    JSON.stringify(cachedStatus),
    'EX',
    HEARTBEAT_TTL_SECONDS
  );

  logger.info('[IOT] Đã lưu heartbeat thiết bị', {
    deviceUid: payload.deviceUid,
    lastSeenAt: payload.timestamp
  });
};

const handleHeartbeatMessage = async (_topic: string, rawPayload: string) => {
  try {
    const payload = JSON.parse(rawPayload) as DeviceHeartbeatPayload;

    if (!payload.deviceUid) {
      logger.warn('[IOT] Heartbeat thiếu deviceUid');
      return;
    }

    await saveDeviceHeartbeat({
      deviceUid: payload.deviceUid,
      batteryLevel: payload.batteryLevel ?? null,
      wifiSsid: payload.wifiSsid ?? null,
      signalStrength: payload.signalStrength ?? null,
      timestamp: payload.timestamp || new Date().toISOString()
    });
  } catch (error) {
    logger.error('[IOT] Lỗi parse heartbeat payload:', error);
  }
};

mqttService.subscribe(HEARTBEAT_TOPIC, handleHeartbeatMessage);

const handleScanUpload = async (input: HandleScanUploadInput): Promise<ScanHttpResponse> => {
  const { file, weight, deviceUid, scanId, requestReceivedAtMs } = input;

  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Không tìm thấy ảnh tải lên');
  }

  const httpResponse: ScanHttpResponse = {
    deviceUid,
    weight,
    imageUrl: '',
    status: 'RECEIVED'
  };

  logger.info('[IOT][Trace] Scan request accepted', {
    scanId,
    deviceUid,
    weight,
    requestReceivedAtMs
  });

  enqueueScanJob({
    fileBuffer: file.buffer,
    weight,
    deviceUid,
    trace: {
      scanId,
      requestReceivedAtMs
    },
    enqueuedAtMs: Date.now()
  });

  return httpResponse;
};

const openScanResultStream = (deviceUid: string, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders?.();

  const clients = sseClients.get(deviceUid) || new Set<Response>();
  clients.add(res);
  sseClients.set(deviceUid, clients);

  logger.info('[SSE] client connected', {
    deviceUid,
    clientCount: clients.size
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ deviceUid })}\n\n`);
  res.flush?.();

  res.on('close', () => {
    const currentClients = sseClients.get(deviceUid);

    if (!currentClients) {
      return;
    }

    currentClients.delete(res);

    if (currentClients.size === 0) {
      sseClients.delete(deviceUid);
    }
  });
};

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

  const updatedDevice = await prisma.device.update({
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

  return updatedDevice;
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

  const updatedDevice = await prisma.device.update({
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

  return updatedDevice;
};

export default {
  handleScanUpload,
  openScanResultStream,
  pairDevice,
  getMyDevices,
  getDeviceStatus,
  saveDeviceHeartbeat,
  unpairDevice
};
