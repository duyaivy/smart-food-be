import iotScanQueueService from './scanQueue.service';
import iotSseService from './sse.service';
import iotDeviceService from './device.service';
import iotMqttPublisherService from './mqttPublisher.service';

/**
 * Thin IoT facade kept for existing controllers/routes.
 * Queueing, processing, MQTT/heartbeat, SSE, and device ownership now live in
 * focused services.
 */
export default {
  handleScanUpload: iotScanQueueService.handleScanUpload,
  openScanResultStream: iotSseService.openScanResultStream,
  pairDevice: iotDeviceService.pairDevice,
  getMyDevices: iotDeviceService.getMyDevices,
  getDeviceStatus: iotDeviceService.getDeviceStatus,
  saveDeviceHeartbeat: iotMqttPublisherService.saveDeviceHeartbeat,
  init: iotMqttPublisherService.init,
  unpairDevice: iotDeviceService.unpairDevice
};
