import mqtt, { MqttClient } from 'mqtt';
import logger from '../config/logger';

class MQTTService {
  private client: MqttClient;

  constructor() {
    this.client = mqtt.connect(process.env.MQTT_BROKER_URL as string, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID || `backend-${Date.now()}`
    });

    this.client.on('connect', () => {
      logger.info('[MQTT] Kết nối broker thành công');
    });

    this.client.on('error', (error) => {
      logger.error('[MQTT] Lỗi kết nối:', error);
    });

    this.client.on('reconnect', () => {
      logger.warn('[MQTT] Đang kết nối lại tới broker...');
    });
  }

  publish(topic: string, payload: Record<string, unknown>) {
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) {
        logger.error('[MQTT] Gửi dữ liệu thất bại:', error);
        return;
      }

      logger.info(`[MQTT] Đã gửi dữ liệu tới topic: ${topic}`);
    });
  }
}

export const mqttService = new MQTTService();
