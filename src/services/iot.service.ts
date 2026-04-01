import streamifier from 'streamifier';
import httpStatus from 'http-status';
import { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import ApiError from '../utils/apiError';
import logger from '../config/logger';
import { mqttService } from './mqtt.service';
import type { HandleScanUploadInput, ScanHttpResponse, ScanMqttPayload } from '../types/iot.type';

const sseClients = new Map<string, Set<Response>>();

const getResultTopic = (deviceUid: string) => {
  return `smart-food/device/${deviceUid}/scan/result`;
};

const publishSSE = (deviceUid: string, payload: ScanMqttPayload) => {
  const clients = sseClients.get(deviceUid);
  logger.info('[SSE] publishScanResult', {
    deviceUid,
    clientCount: clients?.size || 0
  });

  if (!clients) {
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

const mockAiRecognition = async (
  weight: number
): Promise<Omit<ScanMqttPayload, 'deviceUid' | 'imageUrl'>> => {
  return {
    ingredientName: 'Cà rốt',
    calories: 41,
    weight,
    status: 'DONE',
    message: 'Nhận diện nguyên liệu thành công'
  };
};

const publishScanResult = async (payload: ScanMqttPayload) => {
  const topic = getResultTopic(payload.deviceUid);
  mqttService.publish(topic, payload);
  publishSSE(payload.deviceUid, payload);
};

const handleScanUpload = async (input: HandleScanUploadInput): Promise<ScanHttpResponse> => {
  const { file, weight, deviceUid } = input;

  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Không tìm thấy ảnh tải lên');
  }

  const httpResponse: ScanHttpResponse = {
    deviceUid,
    weight,
    imageUrl: '',
    status: 'RECEIVED'
  };

  setTimeout(async () => {
    try {
      const aiResult = await mockAiRecognition(weight);
      const folderName = aiResult.ingredientName || 'unknown';

      const imageUrl = await uploadBufferToCloudinary(file.buffer, folderName);

      await publishScanResult({
        deviceUid,
        ingredientName: aiResult.ingredientName,
        calories: aiResult.calories,
        weight: aiResult.weight,
        status: aiResult.status,
        message: aiResult.message,
        imageUrl
      });
    } catch (error) {
      logger.error('[IOT] Lỗi khi xử lý kết quả quét:', error);

      let fallbackImageUrl = '';

      try {
        fallbackImageUrl = await uploadBufferToCloudinary(file.buffer, 'unknown');
      } catch (uploadError) {
        logger.error('[IOT] Upload fallback unknown thất bại:', uploadError);
      }

      await publishScanResult({
        deviceUid,
        ingredientName: null,
        calories: null,
        weight,
        status: 'FAILED',
        message: 'Xử lý dữ liệu quét thất bại',
        imageUrl: fallbackImageUrl
      });
    }
  }, 3000);

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

export default {
  handleScanUpload,
  openScanResultStream
};
