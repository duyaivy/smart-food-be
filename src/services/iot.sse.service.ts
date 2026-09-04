import { Response } from 'express';
import logger from '../config/logger';
import type { ScanMqttPayload, ScanTraceContext } from '../models/types/iot.type';

const sseClients = new Map<string, Set<Response>>();

const publishScanResult = (
  deviceUid: string,
  payload: ScanMqttPayload,
  trace: ScanTraceContext
) => {
  const clients = sseClients.get(deviceUid);
  const clientCount = clients?.size || 0;

  logger.info('[SSE] publishScanResult', {
    scanId: trace.scanId,
    deviceUid,
    clientCount,
    payload
  });

  if (!clients) {
    logger.warn('[SSE] No active subscribers for scan-result', {
      deviceUid,
      scanId: trace.scanId
    });
    return;
  }

  const data = `event: scan-result\ndata: ${JSON.stringify(payload)}\n\n`;

  clients.forEach((client) => {
    client.write(data);
    client.flush?.();
  });
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
  publishScanResult,
  openScanResultStream
};
