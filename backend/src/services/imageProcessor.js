const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');

/**
 * Crop area gambar berdasarkan bounding box + padding.
 * @param {string} imagePath - Path file gambar original
 * @param {object} bbox - { x, y, width, height }
 * @param {number} padding - pixel padding di setiap sisi (default: 3)
 * @param {string} outputFilename - nama file output
 * @returns {Promise<string>} path file hasil crop
 */
const cropAsset = async (imagePath, bbox, padding = 3, outputFilename) => {
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  const x = Math.max(0, bbox.x - padding);
  const y = Math.max(0, bbox.y - padding);
  const width = Math.min(metadata.width - x, bbox.width + padding * 2);
  const height = Math.min(metadata.height - y, bbox.height + padding * 2);

  // Fallback: jika hasil crop terlalu kecil, return null
  if (width < 20 || height < 20) {
    console.warn(`[ImageProcessor] Crop terlalu kecil (${width}x${height}), skip.`);
    return null;
  }

  const outputPath = path.join(TEMP_DIR, outputFilename || `crop_${Date.now()}.png`);

  await sharp(imagePath)
    .extract({ left: x, top: y, width, height })
    .png()
    .toFile(outputPath);

  return outputPath;
};

/**
 * Resize gambar ke target size menggunakan Sharp (fit: inside, tidak distort).
 * @param {string} inputPath
 * @param {{ width: number, height: number }} targetSize
 * @param {string} outputFilename
 * @returns {Promise<string>} path file hasil resize
 */
const resizeImage = async (inputPath, targetSize, outputFilename) => {
  const outputPath = path.join(TEMP_DIR, outputFilename || `resized_${Date.now()}.png`);

  await sharp(inputPath)
    .resize(targetSize.width, targetSize.height, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toFile(outputPath);

  return outputPath;
};

/**
 * Simpan buffer gambar (base64 decoded) ke temp file.
 * @param {string} base64Data - base64 encoded image
 * @param {string} outputFilename
 * @returns {Promise<string>} path file
 */
const saveBase64Image = async (base64Data, outputFilename) => {
  const outputPath = path.join(TEMP_DIR, outputFilename || `gen_${Date.now()}.png`);
  const buffer = Buffer.from(base64Data, 'base64');
  await fs.promises.writeFile(outputPath, buffer);
  return outputPath;
};

/**
 * Preprocess gambar sebelum dikirim ke OpenAI Vision:
 * - Resize ke max 1500px lebar jika melebihi batas
 * - Return scale factor untuk konversi koordinat bbox
 * @param {string} imagePath
 * @returns {Promise<{ processedPath: string, scaleFactor: number, originalWidth: number, originalHeight: number }>}
 */
const preprocessImageForOpenAI = async (imagePath) => {
  const metadata = await sharp(imagePath).metadata();
  const MAX_WIDTH = 1500;

  if (metadata.width <= MAX_WIDTH) {
    return {
      processedPath: imagePath,
      scaleFactor: 1,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
    };
  }

  const scaleFactor = metadata.width / MAX_WIDTH;
  const newHeight = Math.round(metadata.height / scaleFactor);
  const outputPath = path.join(TEMP_DIR, `preprocessed_${Date.now()}.jpg`);

  await sharp(imagePath)
    .resize(MAX_WIDTH, newHeight)
    .jpeg({ quality: 90 })
    .toFile(outputPath);

  return {
    processedPath: outputPath,
    scaleFactor,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  };
};

/**
 * Konversi koordinat bbox dari skala AI (gambar yang sudah di-resize) ke skala original.
 * @param {object} bbox - { x, y, width, height } dalam skala AI
 * @param {number} scaleFactor - faktor skala dari preprocessImageForOpenAI
 * @returns {object} bbox dalam skala original
 */
const scaleBboxToOriginal = (bbox, scaleFactor) => {
  if (scaleFactor === 1) return bbox;
  return {
    x: Math.round(bbox.x * scaleFactor),
    y: Math.round(bbox.y * scaleFactor),
    width: Math.round(bbox.width * scaleFactor),
    height: Math.round(bbox.height * scaleFactor),
  };
};

/**
 * Baca gambar sebagai base64 untuk dikirim ke OpenAI.
 * @param {string} imagePath
 * @returns {Promise<string>} base64 string
 */
const imageToBase64 = async (imagePath) => {
  const buffer = await fs.promises.readFile(imagePath);
  return buffer.toString('base64');
};

/**
 * Hapus list file sementara (best-effort, tidak throw).
 * @param {string[]} filePaths
 */
const cleanupFiles = async (filePaths) => {
  if (!Array.isArray(filePaths)) return;
  for (const filePath of filePaths) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.warn(`[ImageProcessor] Gagal hapus file ${filePath}:`, err.message);
    }
  }
};

module.exports = {
  cropAsset,
  resizeImage,
  saveBase64Image,
  preprocessImageForOpenAI,
  scaleBboxToOriginal,
  imageToBase64,
  cleanupFiles,
};
