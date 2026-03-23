import express from 'express';
import auth from '../../middlewares/auth';
import { uploadSingle } from '../../middlewares/upload';
import uploadController from '../../controllers/upload.controller';

const router = express.Router();

router.route('/media').post(auth(), uploadSingle, uploadController.uploadMedia);

router.route('/avatar').post(auth(), uploadSingle, uploadController.uploadAvatar);

export default router;
