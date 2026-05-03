const { reviseHTML } = require('../services/openaiVisionClient');
const { generatePlaceholderImage } = require('../services/openaiImageClient');
const { uploadMedia } = require('../services/listmonkClient');

// Kata kunci yang mengindikasikan intent re-generate image
const REGEN_KEYWORDS = [
  'ganti gambar', 'ganti ilustrasi', 'ganti foto',
  're-generate', 'regenerate', 'generate ulang',
  'buat gambar baru', 'buat ilustrasi baru',
  'ubah gambar', 'ubah ilustrasi',
  'replace image', 'replace illustration',
];

/**
 * Deteksi apakah pesan user berisi intent re-generate gambar.
 */
const detectRegenIntent = (message) => {
  const lower = message.toLowerCase();
  return REGEN_KEYWORDS.some((kw) => lower.includes(kw));
};

/**
 * Extract asset ID dari pesan user (mencari pola "asset_xxx" atau nama section).
 * Return null jika tidak spesifik → re-generate semua placeholder.
 */
const extractTargetAssetId = (message, generatedAssets = []) => {
  for (const asset of generatedAssets) {
    if (message.toLowerCase().includes(asset.assetId.toLowerCase())) {
      return asset.assetId;
    }
    // Cek label sederhana (misal: "step 1", "step1", "header")
    const label = asset.assetId.replace(/_/g, ' ');
    if (message.toLowerCase().includes(label.toLowerCase())) {
      return asset.assetId;
    }
  }
  return null;
};

/**
 * POST /api/chat/revise
 */
const revise = async (req, res) => {
  const { userMessage, currentHtml, history = [], generatedAssets = [], styleDescriptor = '' } = req.body;

  if (!userMessage || !currentHtml) {
    return res.status(400).json({
      success: false,
      message: 'userMessage dan currentHtml diperlukan.',
    });
  }

  try {
    const isRegenIntent = detectRegenIntent(userMessage);

    if (isRegenIntent) {
      // ── RE-GENERATE IMAGE FLOW ──
      const targetAssetId = extractTargetAssetId(userMessage, generatedAssets);
      const placeholderAssets = generatedAssets.filter(a => a.category === 'placeholder');
      const assetsToRegen = targetAssetId
        ? placeholderAssets.filter(a => a.assetId === targetAssetId)
        : placeholderAssets;

      if (assetsToRegen.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Tidak ditemukan aset placeholder yang bisa di-re-generate.',
        });
      }

      let updatedHtml = currentHtml;
      const updatedAssets = [...generatedAssets];

      for (const asset of assetsToRegen) {
        // Build prompt: gunakan userMessage sebagai arahan, tambahkan styleDescriptor
        let prompt = userMessage;
        // Jika user tidak minta style berbeda, pertahankan styleDescriptor
        const wantsNewStyle = userMessage.toLowerCase().includes('style') ||
          userMessage.toLowerCase().includes('gaya');
        if (!wantsNewStyle && styleDescriptor) {
          prompt += `, ${styleDescriptor}, no text`;
        } else {
          prompt += ', flat illustration, no text';
        }

        try {
          const targetSize = { width: 400, height: 300 }; // default size
          const genPath = await generatePlaceholderImage(prompt, targetSize, asset.assetId);
          const filename = `regen_${asset.assetId}_${Date.now()}.png`;
          const uploadResult = await uploadMedia(genPath, filename);

          // Update src di HTML
          const oldUrl = asset.listmonkUrl;
          if (oldUrl) {
            updatedHtml = updatedHtml.split(oldUrl).join(uploadResult.url);
          } else {
            // Cari via data-asset-id
            const imgRegex = new RegExp(
              `(<img[^>]*data-asset-id="${asset.assetId}"[^>]*)src="[^"]*"`,
              'g'
            );
            updatedHtml = updatedHtml.replace(imgRegex, `$1src="${uploadResult.url}"`);
          }

          // Update generatedAssets
          const idx = updatedAssets.findIndex(a => a.assetId === asset.assetId);
          if (idx !== -1) {
            updatedAssets[idx] = { ...updatedAssets[idx], listmonkUrl: uploadResult.url };
          }

          // Cleanup temp file
          const fs = require('fs');
          try { fs.unlinkSync(genPath); } catch (_) {}
        } catch (err) {
          console.error(`[Chat] Re-generate error untuk ${asset.assetId}:`, err.message);
        }
      }

      return res.json({
        revisedHtml: updatedHtml,
        assistantMessage: `✓ ${assetsToRegen.length > 1 ? 'Semua ilustrasi' : 'Ilustrasi'} berhasil di-generate ulang. Klik ↩ Undo untuk membatalkan.`,
        updatedAssets,
      });
    }

    // ── NORMAL HTML REVISION FLOW ──
    const { revisedHtml, assistantMessage } = await reviseHTML(userMessage, currentHtml, history);

    return res.json({ revisedHtml, assistantMessage });

  } catch (err) {
    console.error('[Chat] Revise error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'AI gagal memproses permintaan revisi.',
    });
  }
};

module.exports = { revise };
