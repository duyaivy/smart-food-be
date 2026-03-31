import path from 'path';
import httpStatus from 'http-status';
import ApiError from '../utils/apiError';
import { mqttService } from './mqtt.service';

type HandleScanUploadInput = {
  file?: Express.Multer.File;
  weight: number;
  deviceId: string;
  scanId?: string;
};

type ScanHttpResponse = {
  deviceId: string;
  scanId: string;
  weight: number;
  imageUrl: string;
  status: 'RECEIVED';
};

type ScanMqttPayload = {
  deviceId: string;
  scanId: string;
  ingredientName: string | null;
  calories: number | null;
  weight: number;
  status: 'DONE' | 'FAILED';
  message: string;
};

const buildImageUrl = (filename: string) => {
  return `/uploads/${filename}`;
};

const getResultTopic = (deviceId: string) => {
  return `smart-food/device/${deviceId}/scan/result`;
};

const mockAiRecognition = async (
  weight: number
): Promise<Omit<ScanMqttPayload, 'deviceId' | 'scanId'>> => {
  // Giả lập service AI, hiện tại luôn trả dữ liệu mẫu
  const isFail = false;

  if (isFail) {
    return {
      ingredientName: null,
      calories: null,
      weight,
      status: 'FAILED',
      message: 'Không nhận diện được nguyên liệu'
    };
  }

  return {
    ingredientName: 'Cà rốt',
    calories: 41,
    weight,
    status: 'DONE',
    message: 'Nhận diện nguyên liệu thành công'
  };
};

const publishScanResult = async (payload: ScanMqttPayload) => {
  const topic = getResultTopic(payload.deviceId);
  mqttService.publish(topic, payload);
};

const handleScanUpload = async (input: HandleScanUploadInput): Promise<ScanHttpResponse> => {
  const { file, weight, deviceId } = input;
  const scanId = input.scanId || `scan_${Date.now()}`;

  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Không tìm thấy ảnh tải lên');
  }

  const imageUrl = buildImageUrl(path.basename(file.path));

  const httpResponse: ScanHttpResponse = {
    deviceId,
    scanId,
    weight,
    imageUrl,
    status: 'RECEIVED'
  };

  setTimeout(async () => {
    try {
      const aiResult = await mockAiRecognition(weight);

      await publishScanResult({
        deviceId,
        scanId,
        ingredientName: aiResult.ingredientName,
        calories: aiResult.calories,
        weight: aiResult.weight,
        status: aiResult.status,
        message: aiResult.message
      });
    } catch (error) {
      await publishScanResult({
        deviceId,
        scanId,
        ingredientName: null,
        calories: null,
        weight,
        status: 'FAILED',
        message: 'Xử lý dữ liệu quét thất bại'
      });

      console.error('[IOT] Lỗi khi xử lý kết quả quét:', error);
    }
  }, 3000);

  return httpResponse;
};

export default {
  handleScanUpload
};
