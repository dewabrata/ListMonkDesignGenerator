const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createJob, getJob, runPipeline } = require('../services/aiOrchestrator');

const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

// Multer storage: simpan ke temp dir dengan nama unik
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload_${uuidv4()}${ext}`);
  },
});

// Validasi MIME type via magic bytes (multer fileFilter)
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('FORMAT_INVALID'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single('file');

/**
 * POST /api/process
 * Terima file upload, buat job, jalankan pipeline async, return jobId.
 */
const startProcess = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Ukuran file terlalu besar. Maksimum 10MB.',
        });
      }
      if (err.message === 'FORMAT_INVALID') {
        return res.status(400).json({
          success: false,
          message: 'Format tidak didukung. Gunakan JPG atau PNG.',
        });
      }
      return res.status(500).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File tidak ditemukan dalam request.' });
    }

    const filePath = req.file.path;

    // Validasi magic bytes (lebih aman dari sekedar MIME type)
    try {
      const buffer = Buffer.alloc(4);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);

      const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

      if (!isJpeg && !isPng) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          message: 'Format tidak didukung. File harus berupa gambar JPG atau PNG yang valid.',
        });
      }
    } catch (e) {
      console.error('[Upload] Magic bytes check error:', e.message);
    }

    // Buat job dan jalankan pipeline async (non-blocking)
    const jobId = createJob(filePath);
    console.log(`[Upload] Job dibuat: ${jobId}, file: ${req.file.filename}`);

    // Jalankan pipeline tanpa await (async background)
    runPipeline(jobId, filePath).catch((err) => {
      console.error(`[Upload] Pipeline error untuk job ${jobId}:`, err);
    });

    return res.json({ jobId, status: 'processing' });
  });
};

/**
 * GET /api/process/:jobId/status
 * Polling endpoint — return status job saat ini.
 */
const getStatus = (req, res) => {
  const { jobId } = req.params;

  if (!jobId) {
    return res.status(400).json({ success: false, message: 'jobId diperlukan.' });
  }

  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ success: false, message: 'Job tidak ditemukan atau sudah expired.' });
  }

  const response = {
    jobId: job.jobId,
    status: job.status,
    currentStep: job.currentStep,
    totalSteps: job.totalSteps,
    stepMessage: job.stepMessage,
  };

  if (job.imageGenProgress) {
    response.imageGenProgress = job.imageGenProgress;
  }

  if (job.status === 'completed' && job.result) {
    response.result = job.result;
  }

  if (job.status === 'failed' && job.error) {
    response.error = job.error;
  }

  return res.json(response);
};

module.exports = { startProcess, getStatus };
