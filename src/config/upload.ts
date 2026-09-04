import multer from 'multer';
import path from 'path';
import fs from 'fs';
import httpStatus from 'http-status';
import ApiError from '../utils/apiError';

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = `iot-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new ApiError(httpStatus.BAD_REQUEST, 'Chỉ chấp nhận tệp ảnh jpg, jpeg, png hoặc webp')
      );
    }

    cb(null, true);
  }
});
