import multer from 'multer';

export const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Keeps the uploaded file in memory (never written to disk): we only need it
 * long enough to extract the text.
 */
export const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES, files: 1, fields: 5 },
}).single('file');
