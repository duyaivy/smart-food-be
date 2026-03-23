import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadSingle = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận jpg, png, webp'));
    }

    cb(null, true);
  }
}).single('file');
