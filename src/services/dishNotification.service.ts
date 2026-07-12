import logger from '../config/logger';
import notificationService from './notification.service';

const logNotificationError = (error: unknown): void => {
  logger.error('Failed to send notification to all users', error);
};

const notifyDishCreated = (dish: { id: number; name: string }): void => {
  notificationService
    .sendNotificationToAllUsers(
      'Món ăn mới!',
      `Món "${dish.name}" vừa được thêm vào thực đơn. Khám phá ngay!`,
      { screen: 'DishDetail', dishId: dish.id, action: 'CREATE' }
    )
    .catch(logNotificationError);
};

const notifyDishUpdated = (dishId: number): void => {
  notificationService
    .sendNotificationToAllUsers('', '', {
      screen: 'DishDetail',
      dishId,
      action: 'UPDATE'
    })
    .catch(logNotificationError);
};

const notifyDishDeleted = (dishId: number): void => {
  notificationService
    .sendNotificationToAllUsers('', '', {
      screen: 'DishDetail',
      dishId,
      action: 'DELETE'
    })
    .catch(logNotificationError);
};

export default {
  notifyDishCreated,
  notifyDishUpdated,
  notifyDishDeleted
};
