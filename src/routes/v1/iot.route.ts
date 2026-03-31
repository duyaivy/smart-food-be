import express from 'express';
import validate from '../../middlewares/validate';
import { upload } from '../../config/upload';
import iotController from '../../controllers/iot.controller';
import iotValidation from '../../validations/iot.validation';

const router = express.Router();

router.post(
  '/scans',
  upload.single('image'),
  validate(iotValidation.uploadScan),
  iotController.uploadScan
);

export default router;
