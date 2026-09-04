import redis from '../redis';
import logger from '../config/logger';
import { mqttService } from './mqtt.service';
import iotSseService from './iot.sse.service';
import { vietnameseToAscii } from '../utils/formats';
import type {
  CachedDeviceStatus,
  DeviceHeartbeatPayload,
  ScanMqttPayload,
  ScanTraceContext
} from '../models/types/iot.type';

const HEARTBEAT_TOPIC = 'smart-food/device/+/status/heartbeat';
export const HEARTBEAT_TTL_SECONDS = 180;
export const ONLINE_THRESHOLD_MS = 90 * 1000;

export const getDeviceStatusCacheKey = (deviceUid: string) => {
  return `iot:device:status:${deviceUid}`;
};

const getResultTopic = (deviceUid: string) => {
  return `smart-food/device/${deviceUid}/scan/result`;
};

const publishScanResult = async (payload: ScanMqttPayload, trace: ScanTraceContext) => {
  const topic = getResultTopic(payload.deviceUid);
  const payloadEsp = {
    ...payload,
    ingredientName: vietnameseToAscii(payload.ingredientName || '')
  };
  mqttService.publish(topic, payloadEsp);
  iotSseService.publishScanResult(payload.deviceUid, payload, trace);
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

const init = () => {
  mqttService.subscribe(HEARTBEAT_TOPIC, handleHeartbeatMessage);
};

export default {
  init,
  publishScanResult,
  saveDeviceHeartbeat
};
