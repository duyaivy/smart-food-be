import prisma from '../client';
import logger from '../config/logger';
import config from '../config/config';
import uploadService from './upload.service';
import ingredientClassifierService from './ingredientClassification.service';
import iotMqttPublisherService from './iot.mqttPublisher.service';
import { calcCalories } from '../utils/calc';
import type { ScanQueueJob, ScanTraceContext } from '../models/types/iot.type';

type CloudinaryUploadResult = {
  secure_url?: string;
};

const sanitizeFolderName = (value: string) => {
  const sanitized = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.+$/g, '');

  return sanitized || 'unknown';
};

const uploadScanImage = async (
  fileBuffer: Buffer,
  folder: string,
  trace: ScanTraceContext,
  deviceUid: string
) => {
  if (!config.cloudinary.uploadPredict) {
    logger.info('[IOT][Trace] Skip image upload because CLOUDINARY_UPLOAD_PREDICT=false', {
      scanId: trace.scanId,
      deviceUid,
      folderName: folder
    });
    return;
  }

  await (uploadService.uploadToCloudinary(
    { buffer: fileBuffer },
    `smart-food/${folder}`
  ) as Promise<CloudinaryUploadResult>);

  logger.info('[IOT][Trace] Image upload completed', {
    scanId: trace.scanId,
    deviceUid,
    folderName: folder
  });
};

const executeScanJob = async (
  job: ScanQueueJob,
  queueState: { queueLength: number; activeScanJobs: number }
) => {
  const { fileBuffer, weight, deviceUid, trace, enqueuedAtMs } = job;
  const { scanId, requestReceivedAtMs } = trace;
  const processingStartedAtMs = Date.now();

  logger.info('[IOT][Queue] Job started', {
    scanId,
    deviceUid,
    queueWaitMs: processingStartedAtMs - enqueuedAtMs,
    queuedMs: processingStartedAtMs - requestReceivedAtMs,
    queueLength: queueState.queueLength,
    activeScanJobs: queueState.activeScanJobs
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
    void uploadScanImage(fileBuffer, folderName, trace, deviceUid);

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

    const ingredient = await prisma.ingredient.findUnique({
      where: {
        id: bestPrediction.labelId
      }
    });
    const calories: number = calcCalories(
      ingredient?.protein,
      ingredient?.carb,
      ingredient?.fat,
      weight
    );

    await iotMqttPublisherService.publishScanResult(
      {
        deviceUid,
        ingredientId: bestPrediction.labelId,
        ingredientName: bestPrediction.label,
        predictedConfidence: bestPrediction.confidence,
        calories: calories ?? 0,
        protein: ingredient?.protein ?? 0,
        carb: ingredient?.carb ?? 0,
        fat: ingredient?.fat ?? 0,
        weight,
        status: 'DONE',
        message: `Nhận diện nguyên liệu thành công (${Math.round(
          bestPrediction.confidence * 100
        )}%)`
      },
      trace
    );
  } catch (error) {
    logger.error('[IOT] Lỗi khi xử lý kết quả quét:', {
      scanId,
      deviceUid,
      error
    });

    void uploadScanImage(fileBuffer, 'unknown', trace, deviceUid).catch((uploadError) => {
      logger.error('[IOT] Upload fallback unknown thất bại:', {
        scanId,
        deviceUid,
        uploadError
      });
    });

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

    await iotMqttPublisherService.publishScanResult(
      {
        deviceUid,
        ingredientId: -1,
        ingredientName: null,
        predictedConfidence: 0,
        protein: 0,
        carb: 0,
        fat: 0,
        calories: 0,
        weight,
        status: 'FAILED',
        message: 'Xử lý dữ liệu quét thất bại'
      },
      trace
    );
  }
};

export default {
  executeScanJob
};
