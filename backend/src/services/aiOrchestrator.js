const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const imageProcessor = require('./imageProcessor');
const { analyzeImage, generateHTML } = require('./openaiVisionClient');
const { generatePlaceholderImage } = require('./openaiImageClient');
const { uploadMedia } = require('./listmonkClient');

// ============================================================
// IN-MEMORY JOB STORE
// ============================================================

const jobStore = new Map(); // jobId → Job object
const JOB_TTL_MS = 10 * 60 * 1000; // 10 menit

// Cleanup expired jobs setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobStore.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      // Cleanup temp files
      imageProcessor.cleanupFiles(job.tempFilePaths).catch(() => {});
      jobStore.delete(jobId);
      console.log(`[JobStore] Job ${jobId} expired & cleaned.`);
    }
  }
}, 5 * 60 * 1000);

/**
 * Buat job baru dan return jobId.
 */
const createJob = (uploadedFilePath) => {
  const jobId = uuidv4();
  const job = {
    jobId,
    status: 'pending',
    currentStep: 0,
    totalSteps: 7,
    stepMessage: 'Menginisialisasi...',
    imageGenProgress: null,
    tempFilePaths: [uploadedFilePath],
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  jobStore.set(jobId, job);
  return jobId;
};

/**
 * Ambil job dari store.
 */
const getJob = (jobId) => jobStore.get(jobId) || null;

/**
 * Update progress job.
 */
const updateJob = (jobId, updates) => {
  const job = jobStore.get(jobId);
  if (job) Object.assign(job, updates);
};

// ============================================================
// STEP MESSAGES (7 langkah sesuai FSD 5.2.5)
// ============================================================
const STEP_MESSAGES = [
  '',                                           // 0 (unused)
  'Mengunggah gambar...',                       // 1
  'Menganalisis desain dan mengidentifikasi elemen...', // 2
  'Memotong aset brand dari mockup...',          // 3
  'Membuat ilustrasi baru dengan AI...',         // 4 (akan diupdate dengan counter)
  'Mengunggah semua aset ke Listmonk...',        // 5
  'Merakit kode HTML template...',               // 6
  'Selesai! Template siap direview.',            // 7
];

// ============================================================
// PIPELINE UTAMA
// ============================================================

/**
 * Jalankan 8-langkah AI pipeline secara async.
 * @param {string} jobId
 * @param {string} uploadedFilePath - path file gambar yang di-upload user
 */
const runPipeline = async (jobId, uploadedFilePath) => {
  const tempFiles = [uploadedFilePath];

  try {
    // ── STEP 1: Upload done (sudah di-handle oleh uploadController) ──
    updateJob(jobId, { status: 'processing', currentStep: 1, stepMessage: STEP_MESSAGES[1] });

    // ── STEP 2: Preprocess + Pass 1 Vision Analysis ──
    updateJob(jobId, { currentStep: 2, stepMessage: STEP_MESSAGES[2] });

    const { processedPath, scaleFactor } = await imageProcessor.preprocessImageForOpenAI(uploadedFilePath);
    if (processedPath !== uploadedFilePath) tempFiles.push(processedPath);

    const mimeType = uploadedFilePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const imageBase64 = await imageProcessor.imageToBase64(processedPath);

    const analysisResult = await analyzeImage(imageBase64, mimeType);
    console.log(`[Pipeline] Pass 1 selesai. Assets: ${analysisResult.image_assets?.length || 0}, Sections: ${analysisResult.sections?.length || 0}`);

    // ── STEP 3: Crop structural assets ──
    updateJob(jobId, { currentStep: 3, stepMessage: STEP_MESSAGES[3] });

    const assetUrlMap = {};
    const generatedAssets = [];

    const structuralAssets = (analysisResult.image_assets || []).filter(a => a.category === 'structural');
    const placeholderAssets = (analysisResult.image_assets || []).filter(a => a.category === 'placeholder');

    for (const asset of structuralAssets) {
      try {
        // Scale bbox jika gambar sudah di-resize sebelum ke OpenAI
        const scaledBbox = imageProcessor.scaleBboxToOriginal(asset.bbox, scaleFactor);
        const cropFilename = `crop_${asset.id}_${Date.now()}.png`;
        const cropPath = await imageProcessor.cropAsset(uploadedFilePath, scaledBbox, 3, cropFilename);

        if (cropPath) {
          tempFiles.push(cropPath);
          asset._tempFilePath = cropPath;
        } else {
          console.warn(`[Pipeline] Crop fallback untuk ${asset.id} — akan di-generate via AI`);
          asset.category = 'placeholder'; // fallback: pindah ke placeholder
          asset.suggested_prompt = asset.description + ', flat design, no text';
          asset.target_size = asset.target_size || { width: 200, height: 100 };
          placeholderAssets.push(asset);
        }
      } catch (err) {
        console.error(`[Pipeline] Crop error untuk ${asset.id}:`, err.message);
        asset._error = err.message;
      }
    }

    // ── STEP 4: Generate placeholder assets ──
    const totalPlaceholders = placeholderAssets.length;
    updateJob(jobId, {
      currentStep: 4,
      stepMessage: totalPlaceholders > 0
        ? `Membuat ilustrasi baru dengan AI (0/${totalPlaceholders})...`
        : 'Tidak ada ilustrasi yang perlu di-generate...',
      imageGenProgress: { current: 0, total: totalPlaceholders },
    });

    for (let i = 0; i < placeholderAssets.length; i++) {
      const asset = placeholderAssets[i];
      const progress = `${i + 1}/${totalPlaceholders}`;

      updateJob(jobId, {
        stepMessage: `Membuat ilustrasi baru dengan AI (${progress})...`,
        imageGenProgress: { current: i + 1, total: totalPlaceholders },
      });

      try {
        const targetSize = asset.target_size || { width: 400, height: 300 };
        const genPath = await generatePlaceholderImage(
          asset.suggested_prompt || asset.description + ', flat illustration, no text',
          targetSize,
          asset.id
        );
        tempFiles.push(genPath);
        asset._tempFilePath = genPath;
        console.log(`[Pipeline] Generated ${asset.id} (${progress})`);
      } catch (err) {
        console.error(`[Pipeline] Generate error untuk ${asset.id}:`, err.message);
        asset._error = err.message;
      }
    }

    // ── STEP 5: Upload semua assets ke Listmonk ──
    updateJob(jobId, { currentStep: 5, stepMessage: STEP_MESSAGES[5] });

    const allAssets = [...structuralAssets, ...placeholderAssets];

    for (const asset of allAssets) {
      if (asset._error || !asset._tempFilePath) {
        // Gambar gagal — akan menggunakan src="" dengan warning badge
        assetUrlMap[asset.id] = '';
        generatedAssets.push({
          assetId: asset.id,
          category: asset.category,
          listmonkUrl: '',
          error: asset._error || 'File tidak tersedia',
        });
        continue;
      }

      try {
        const filename = `${asset.id}_${Date.now()}.png`;
        const uploadResult = await uploadMedia(asset._tempFilePath, filename);
        assetUrlMap[asset.id] = uploadResult.url;
        generatedAssets.push({
          assetId: asset.id,
          category: asset.category,
          listmonkUrl: uploadResult.url,
          listmonkMediaId: uploadResult.id,
        });
        console.log(`[Pipeline] Uploaded ${asset.id} → ${uploadResult.url}`);
      } catch (err) {
        console.error(`[Pipeline] Upload error untuk ${asset.id}:`, err.message);
        assetUrlMap[asset.id] = '';
        generatedAssets.push({
          assetId: asset.id,
          category: asset.category,
          listmonkUrl: '',
          error: err.message,
        });
      }
    }

    // ── STEP 6: Generate HTML (Pass 2) ──
    updateJob(jobId, { currentStep: 6, stepMessage: STEP_MESSAGES[6] });

    // Gunakan gambar original (bukan preprocessed) sebagai konteks visual
    const originalBase64 = await imageProcessor.imageToBase64(uploadedFilePath);
    const htmlResult = await generateHTML(originalBase64, mimeType, analysisResult, assetUrlMap);

    // Ekstrak variabel Go Template yang terdeteksi
    const variableRegex = /\{\{[^}]+\}\}/g;
    const detectedVariables = [...new Set(htmlResult.match(variableRegex) || [])];

    // ── STEP 7: Selesai ──
    updateJob(jobId, {
      currentStep: 7,
      stepMessage: STEP_MESSAGES[7],
      status: 'completed',
      result: {
        html: htmlResult,
        detectedVariables,
        styleDescriptor: analysisResult.style_descriptor || '',
        generatedAssets,
      },
    });

    console.log(`[Pipeline] Job ${jobId} SELESAI.`);

  } catch (err) {
    console.error(`[Pipeline] Job ${jobId} GAGAL:`, err.message, err.stack);
    updateJob(jobId, {
      status: 'failed',
      error: err.message || 'Pipeline gagal tanpa pesan error.',
    });
  } finally {
    // Cleanup temp files
    await imageProcessor.cleanupFiles(tempFiles);
  }
};

module.exports = { createJob, getJob, updateJob, runPipeline };
