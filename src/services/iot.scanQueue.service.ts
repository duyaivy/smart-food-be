import httpStatus from 'http-status';
import ApiError from '../utils/apiError';
import logger from '../config/logger';
import iotScanProcessorService from './iot.scanProcessor.service';
import type {
  HandleScanUploadInput,
  ScanHttpResponse,
  ScanQueueJob
} from '../models/types/iot.type';

const SCAN_QUEUE_CONCURRENCY = 1;
const scanJobQueue: ScanQueueJob[] = [];
let activeScanJobs = 0;

const processScanQueue = () => {
  while (activeScanJobs < SCAN_QUEUE_CONCURRENCY && scanJobQueue.length > 0) {
    const job = scanJobQueue.shift();

    if (!job) {
      return;
    }

    activeScanJobs += 1;

    void iotScanProcessorService
      .executeScanJob(job, {
        queueLength: scanJobQueue.length,
        activeScanJobs
      })
      .catch((error) => {
        logger.error('[IOT][Queue] Unexpected scan job execution error:', {
          scanId: job.trace.scanId,
          deviceUid: job.deviceUid,
          error
        });
      })
      .finally(() => {
        activeScanJobs -= 1;
        logger.info('[IOT][Queue] Job finished', {
          scanId: job.trace.scanId,
          deviceUid: job.deviceUid,
          queueLength: scanJobQueue.length,
          activeScanJobs
        });
        processScanQueue();
      });
  }
};

const enqueueScanJob = (job: ScanQueueJob) => {
  scanJobQueue.push(job);

  logger.info('[IOT][Queue] Job enqueued', {
    scanId: job.trace.scanId,
    deviceUid: job.deviceUid,
    queueLength: scanJobQueue.length,
    activeScanJobs,
    concurrency: SCAN_QUEUE_CONCURRENCY
  });

  processScanQueue();
};

const handleScanUpload = async (input: HandleScanUploadInput): Promise<ScanHttpResponse> => {
  const { file, weight, deviceUid, scanId, requestReceivedAtMs } = input;

  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Không tìm thấy ảnh tải lên');
  }

  const httpResponse: ScanHttpResponse = {
    deviceUid,
    weight,
    imageUrl: '',
    status: 'RECEIVED'
  };

  logger.info('[IOT][Trace] Scan request accepted', {
    scanId,
    deviceUid,
    weight,
    requestReceivedAtMs
  });

  enqueueScanJob({
    fileBuffer: file.buffer,
    weight,
    deviceUid,
    trace: {
      scanId,
      requestReceivedAtMs
    },
    enqueuedAtMs: Date.now()
  });

  return httpResponse;
};

export default {
  handleScanUpload
};
