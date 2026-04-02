import express from 'express';
import auth from '../../middlewares/auth';
import validate from '../../middlewares/validate';
import iotController from '../../controllers/iot.controller';
import iotValidation from '../../validations/iot.validation';
import { uploadSingle } from '../../middlewares/upload';

const router = express.Router();

router.post('/devices/pair', auth(), validate(iotValidation.pairDevice), iotController.pairDevice);

router.get('/devices', auth(), iotController.getMyDevices);

router.get(
  '/devices/:deviceUid/status',
  auth(),
  validate(iotValidation.getDeviceStatus),
  iotController.getDeviceStatus
);

router.post('/scan', uploadSingle, validate(iotValidation.uploadScan), iotController.uploadScan);

router.get('/devices/:deviceUid/stream', iotController.streamScanResult);

export default router;
