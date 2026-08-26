import mqtt, { MqttClient } from 'mqtt';
import logger from '../config/logger';

type MessageHandler = (topic: string, payload: string) => void;

class MQTTService {
  private client: MqttClient;
  private handlers = new Map<string, MessageHandler[]>();
  private clientId: string;

  constructor() {
    const baseClientId = process.env.MQTT_CLIENT_ID || 'smart-food-backend';
    this.clientId = `${baseClientId}-${process.pid}`;

    this.client = mqtt.connect(process.env.MQTT_BROKER_URL as string, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: this.clientId,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      keepalive: 30,
      clean: true
    });

    this.client.on('connect', () => {
      logger.info(`[MQTT] Kết nối broker thành công (clientId=${this.clientId})`);
    });

    this.client.on('error', (error) => {
      logger.error('[MQTT] Lỗi kết nối:', error);
    });

    this.client.on('offline', () => {
      logger.warn('[MQTT] Client offline');
    });

    this.client.on('close', () => {
      logger.warn('[MQTT] Kết nối đã đóng');
    });

    this.client.on('disconnect', (packet) => {
      logger.warn(
        `[MQTT] Bị broker ngắt kết nối (reasonCode=${packet.reasonCode}, clientId=${this.clientId})`
      );
    });

    this.client.on('reconnect', () => {
      logger.warn('[MQTT] Đang kết nối lại tới broker...');
    });

    this.client.on('message', (topic, message) => {
      const payload = message.toString();
      const handlers = this.handlers.get(topic) || [];

      handlers.forEach((handler) => {
        try {
          handler(topic, payload);
        } catch (error) {
          logger.error('[MQTT] Lỗi xử lý message exact topic:', error);
        }
      });

      this.handlers.forEach((topicHandlers, pattern) => {
        if (pattern === topic) {
          return;
        }

        if (this.matchTopic(pattern, topic)) {
          topicHandlers.forEach((handler) => {
            try {
              handler(topic, payload);
            } catch (error) {
              logger.error('[MQTT] Lỗi xử lý message wildcard topic:', error);
            }
          });
        }
      });
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

  subscribe(topic: string, handler: MessageHandler) {
    const currentHandlers = this.handlers.get(topic) || [];
    this.handlers.set(topic, [...currentHandlers, handler]);

    this.client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        logger.error(`[MQTT] Subscribe thất bại topic ${topic}:`, error);
        return;
      }

      logger.info(`[MQTT] Đã subscribe topic: ${topic}`);
    });
  }

  private matchTopic(pattern: string, topic: string) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts.length !== topicParts.length) {
      return false;
    }

    return patternParts.every((part, index) => {
      return part === '+' || part === topicParts[index];
    });
  }
}

export const mqttService = new MQTTService();
