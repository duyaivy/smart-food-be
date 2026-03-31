import mqtt, { MqttClient } from 'mqtt';

class MQTTService {
  private client: MqttClient;

  constructor() {
    this.client = mqtt.connect(process.env.MQTT_BROKER_URL as string, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID || `backend-${Date.now()}`
    });

    this.client.on('connect', () => {
      console.log('[MQTT] Kết nối broker thành công');
    });

    this.client.on('error', (error) => {
      console.error('[MQTT] Lỗi kết nối:', error);
    });

    this.client.on('reconnect', () => {
      console.log('[MQTT] Đang kết nối lại tới broker...');
    });
  }

  publish(topic: string, payload: Record<string, unknown>) {
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) {
        console.error('[MQTT] Gửi dữ liệu thất bại:', error);
        return;
      }

      console.log('[MQTT] Đã gửi dữ liệu tới topic:', topic);
      console.log('[MQTT] Payload:', payload);
    });
  }
}

export const mqttService = new MQTTService();
