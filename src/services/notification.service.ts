import Expo, { ExpoPushMessage, ExpoPushTicket, ExpoPushReceiptId } from 'expo-server-sdk';
import { Prisma } from '@prisma/client';
import cron from 'node-cron';
import prisma from '../client';
import logger from '../config/logger';

const expo = new Expo();

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const sendNotificationToUser = async (
  userId: number,
  payload: NotificationPayload
): Promise<void> => {
  const pushTokens = await prisma.pushToken.findMany({
    where: { userId }
  });

  if (pushTokens.length === 0) {
    logger.warn(`[Notification] No push token found for user ${userId}`);
    return;
  }

  const validTokens = pushTokens.filter((pt) => Expo.isExpoPushToken(pt.token));

  if (validTokens.length === 0) {
    logger.warn(`[Notification] No valid push token for user ${userId}`);
    return;
  }

  // Build messages
  const messages: (ExpoPushMessage & { _pushTokenId: number })[] = validTokens.map((pt) => ({
    to: pt.token,
    ...(payload.title ? { title: payload.title, sound: 'default' as const } : {}),
    ...(payload.body ? { body: payload.body } : {}),
    data: payload.data ?? {},
    _pushTokenId: pt.id
  }));

  await sendAndLogMessages(messages, payload);
};

const sendNotificationToAllUsers = async (
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> => {
  const pushTokens = await prisma.pushToken.findMany();

  if (pushTokens.length === 0) {
    logger.warn('[Notification] No push tokens found in the system');
    return;
  }

  const validTokens = pushTokens.filter((pt) => Expo.isExpoPushToken(pt.token));

  if (validTokens.length === 0) {
    logger.warn('[Notification] No valid push tokens found');
    return;
  }

  const messages: (ExpoPushMessage & { _pushTokenId: number })[] = validTokens.map((pt) => ({
    to: pt.token,
    ...(title ? { title, sound: 'default' as const } : {}),
    ...(body ? { body } : {}),
    data: data ?? {},
    _pushTokenId: pt.id
  }));

  await sendAndLogMessages(messages, { title, body, data });
};

const sendAndLogMessages = async (
  messages: (ExpoPushMessage & { _pushTokenId: number })[],
  payload: NotificationPayload
): Promise<void> => {
  const chunks = chunkArray(messages, 100);

  for (const chunk of chunks) {
    try {
      // Build clean Expo messages (without _pushTokenId)
      const expoMessages: ExpoPushMessage[] = chunk.map(({ _pushTokenId, ...msg }) => msg);

      const ticketChunk: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(expoMessages);

      // Persist each ticket as a PushNotificationLog
      const logPromises = ticketChunk.map((ticket, idx) => {
        const pushTokenId = chunk[idx]._pushTokenId;

        if (ticket.status === 'ok') {
          return prisma.pushNotificationLog.create({
            data: {
              pushTokenId,
              title: payload.title,
              body: payload.body,
              data: (payload.data ?? {}) as Prisma.InputJsonValue,
              expoTicketId: ticket.id,
              ticketStatus: 'ok',
              receiptStatus: null,
              status: 'SENT',
              sentAt: new Date(),
              deliveredAt: null
            }
          });
        }

        // ticket.status === 'error'
        logger.error(
          `[Notification] Ticket error for pushTokenId=${pushTokenId}: ${ticket.message}`
        );

        // If the token is invalid, clean it up
        if (ticket.details?.error === 'DeviceNotRegistered') {
          logger.info(`[Notification] Removing invalid push token pushTokenId=${pushTokenId}`);
          prisma.pushToken
            .delete({ where: { id: pushTokenId } })
            .catch((e) => logger.error(`[Notification] Failed to delete pushToken: ${e}`));
        }

        return prisma.pushNotificationLog.create({
          data: {
            pushTokenId,
            title: payload.title,
            body: payload.body,
            data: (payload.data ?? {}) as Prisma.InputJsonValue,
            expoTicketId: null,
            ticketStatus: 'error',
            receiptStatus: null,
            receiptDetails: {
              error: ticket.details?.error,
              message: ticket.message
            } as Prisma.InputJsonValue,
            status: 'FAILED',
            sentAt: new Date(),
            deliveredAt: null
          }
        });
      });

      await Promise.allSettled(logPromises);

      logger.info(
        `[Notification] Sent ${chunk.length} notifications, ${
          ticketChunk.filter((t) => t.status === 'ok').length
        } succeeded`
      );
    } catch (error) {
      logger.error(`[Notification] Failed to send push notification chunk: ${error}`);
    }
  }
};

const checkPushReceipts = async (): Promise<void> => {
  logger.info('[Notification Cron] Starting push receipt check...');

  try {
    // Find all logs that are SENT but haven't received a receipt yet
    const pendingLogs = await prisma.pushNotificationLog.findMany({
      where: {
        status: 'SENT',
        expoTicketId: { not: null },
        receiptStatus: null
      },
      take: 1000 // Process in batches of 1000
    });

    if (pendingLogs.length === 0) {
      logger.info('[Notification Cron] No pending receipts to check');
      return;
    }

    logger.info(`[Notification Cron] Checking ${pendingLogs.length} receipts...`);

    // Build receiptId → logId mapping
    const receiptIdToLogMap = new Map<string, number>();
    const receiptIds: ExpoPushReceiptId[] = [];

    for (const log of pendingLogs) {
      if (log.expoTicketId) {
        receiptIds.push(log.expoTicketId);
        receiptIdToLogMap.set(log.expoTicketId, log.id);
      }
    }

    // Fetch receipts in chunks (Expo recommends max ~300 at a time)
    const receiptIdChunks = chunkArray(receiptIds, 300);

    for (const chunk of receiptIdChunks) {
      try {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

        for (const [receiptId, receipt] of Object.entries(receipts)) {
          const logId = receiptIdToLogMap.get(receiptId);
          if (!logId) continue;

          if (receipt.status === 'ok') {
            await prisma.pushNotificationLog.update({
              where: { id: logId },
              data: {
                receiptStatus: 'ok',
                status: 'DELIVERED',
                deliveredAt: new Date()
              }
            });
          } else if (receipt.status === 'error') {
            logger.error(`[Notification Cron] Receipt error for ${receiptId}: ${receipt.message}`);

            await prisma.pushNotificationLog.update({
              where: { id: logId },
              data: {
                receiptStatus: 'error',
                receiptDetails: {
                  error: receipt.details?.error,
                  message: receipt.message
                },
                status: 'FAILED'
              }
            });

            // Clean up invalid tokens
            if (receipt.details?.error === 'DeviceNotRegistered') {
              const log = pendingLogs.find((l) => l.id === logId);
              if (log) {
                logger.info(
                  `[Notification Cron] Removing invalid token pushTokenId=${log.pushTokenId}`
                );
                await prisma.pushToken
                  .delete({ where: { id: log.pushTokenId } })
                  .catch((e) =>
                    logger.error(`[Notification Cron] Failed to delete pushToken: ${e}`)
                  );
              }
            }
          }
        }

        logger.info(`[Notification Cron] Processed ${Object.keys(receipts).length} receipts`);
      } catch (error) {
        logger.error(`[Notification Cron] Failed to fetch receipts: ${error}`);
      }
    }

    // Mark very old SENT logs (>24h without receipt) as FAILED
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleResult = await prisma.pushNotificationLog.updateMany({
      where: {
        status: 'SENT',
        receiptStatus: null,
        sentAt: { lt: staleThreshold }
      },
      data: {
        status: 'FAILED',
        receiptStatus: 'timeout',
        receiptDetails: { error: 'RECEIPT_TIMEOUT', message: 'No receipt after 24 hours' }
      }
    });

    if (staleResult.count > 0) {
      logger.warn(`[Notification Cron] Marked ${staleResult.count} stale notifications as FAILED`);
    }

    logger.info('[Notification Cron] Push receipt check completed');
  } catch (error) {
    logger.error(`[Notification Cron] Critical error: ${error}`);
  }
};

const startPushReceiptCron = (): void => {
  cron.schedule('0 * * * *', async () => {
    logger.info('[Notification Cron] Cron job triggered - checking receipts');
    await checkPushReceipts();
  });

  logger.info('[Notification Cron] Cron job initialized (every 1 hour)');
};

export { startPushReceiptCron };

export default {
  sendNotificationToUser,
  sendNotificationToAllUsers,
  checkPushReceipts,
  startPushReceiptCron
};
