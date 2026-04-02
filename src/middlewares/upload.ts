import multer from 'multer';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

const storage = multer.memoryStorage();

const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowed.includes(file.mimetype)) {
      return cb(new ApiError(httpStatus.BAD_REQUEST, 'Chỉ chấp nhận jpg, png, webp'));
    }

    cb(null, true);
  }
});

export const uploadSingle = upload.single('file');
