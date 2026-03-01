import { Server } from 'http';
import app from './app';
import prisma from './client';
import redis from './redis';
import config from './config/config';
import logger from './config/logger';

let server: Server;
prisma.$connect().then(() => {
  logger.info('Connected to PostgreSQL');
  if (redis) {
    logger.info('Redis client initialized');
  } else {
    logger.warn('Redis is disabled (REDIS_URL not set)');
  }
  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });
});

const exitHandler = () => {
  if (server) {
    server.close(async () => {
      logger.info('Server closed');
      await prisma.$disconnect();
      if (redis) {
        await redis.quit();
        logger.info('Redis disconnected');
      }
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: unknown) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
