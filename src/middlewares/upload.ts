import multer from 'multer';
import httpStatus from 'http-status';
import ApiError from '../utils/apiError';

const storage = multer.memoryStorage();

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

export const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    const isMimeOk = allowedMimeTypes.includes(file.mimetype);
    const isExtOk = allowedExtensions.includes(ext);

    if (!isMimeOk && !isExtOk) {
      return cb(new ApiError(httpStatus.BAD_REQUEST, 'Chỉ chấp nhận jpg, png, webp'));
    }

    cb(null, true);
  }
});

export const uploadSingle = upload.single('file');
