const OpenAI = require('openai');
const path = require('path');
const { saveBase64Image, resizeImage } = require('./imageProcessor');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate gambar placeholder menggunakan gpt-image-2.
 * @param {string} prompt - deskripsi gambar yang akan di-generate
 * @param {object} targetSize - { width, height } untuk resize setelah generate
 * @param {string} assetId - untuk penamaan file
 * @returns {Promise<string>} path file gambar yang sudah di-resize
 */
const generatePlaceholderImage = async (prompt, targetSize, assetId) => {
  const attempt = async () => {
    const response = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'auto',
    });

    const b64Data = response.data[0]?.b64_json;
    if (!b64Data) {
      throw new Error('OpenAI Image Generation tidak mengembalikan base64 data.');
    }

    // Simpan ke temp file dulu (1024x1024)
    const rawFilename = `gen_raw_${assetId}_${Date.now()}.png`;
    const rawPath = await saveBase64Image(b64Data, rawFilename);

    // Resize ke target size
    const resizedFilename = `gen_${assetId}_${Date.now()}.png`;
    const resizedPath = await resizeImage(rawPath, targetSize, resizedFilename);

    // Hapus raw file
    const fs = require('fs');
    try { fs.unlinkSync(rawPath); } catch (_) {}

    return resizedPath;
  };

  try {
    return await attempt();
  } catch (err) {
    console.warn(`[ImageClient] Generate attempt 1 gagal untuk ${assetId}, retry...`, err.message);
    await sleep(3000);
    return await attempt(); // retry 1x
  }
};

module.exports = { generatePlaceholderImage };
