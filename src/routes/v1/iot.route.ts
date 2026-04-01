import express from 'express';
import validate from '../../middlewares/validate';
import { upload } from '../../middlewares/upload';
import iotController from '../../controllers/iot.controller';
import iotValidation from '../../validations/iot.validation';

const router = express.Router();

router.post(
  '/scans',
  upload.single('image'),
  validate(iotValidation.uploadScan),
  iotController.uploadScan
);

router.get('/scans/stream/:deviceUid', iotController.streamScanResult);

export default router;
