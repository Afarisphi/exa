import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 1 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
    } else {
      cb(null, true);
    }
  }
});
