const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getTemplates, createTemplate, updateTemplate, getCampaigns, getCampaignAnalytics } = require('../services/listmonkClient');

/**
 * GET /api/listmonk/templates
 * Proxy ke Listmonk GET /api/templates
 */
router.get('/templates', requireAuth, async (req, res) => {
  try {
    const templates = await getTemplates();
    return res.json({ templates });
  } catch (err) {
    console.error('[Listmonk] Get templates error:', err.message);
    return res.status(503).json({
      success: false,
      message: 'Tidak dapat terhubung ke Listmonk. Periksa konfigurasi server.',
    });
  }
});

/**
 * POST /api/listmonk/templates/save
 * Create baru atau update existing template
 */
router.post('/templates/save', requireAuth, async (req, res) => {
  const { action, templateId, templateName, templateType, html } = req.body;

  if (!html || !templateName) {
    return res.status(400).json({ success: false, message: 'templateName dan html wajib diisi.' });
  }

  // Listmonk valid types: 'campaign', 'campaign_visual', 'tx'
  const VALID_TYPES = ['campaign', 'campaign_visual', 'tx'];
  const safeType = VALID_TYPES.includes(templateType) ? templateType : 'campaign';

  // Strip internal data attributes sebelum kirim ke Listmonk
  const cleanHtml = html
    .replace(/\s*data-asset-id="[^"]*"/g, '')
    .replace(/\s*data-regeneratable="[^"]*"/g, '');

  // Sanitasi nama template
  const safeName = templateName.trim().replace(/[<>&"]/g, '');

  try {
    if (action === 'update') {
      if (!templateId) {
        return res.status(400).json({ success: false, message: 'templateId diperlukan untuk update.' });
      }
      const result = await updateTemplate(templateId, safeName, safeType, cleanHtml);
      return res.json({ success: true, templateId: result.id, templateName: result.name });
    } else {
      const result = await createTemplate(safeName, safeType, cleanHtml);
      return res.json({ success: true, templateId: result.id, templateName: result.name });
    }
  } catch (err) {
    console.error('[Listmonk] Save template error:', err.message);
    console.error('[Listmonk] Response status:', err.response?.status);
    console.error('[Listmonk] Response data:', JSON.stringify(err.response?.data));

    if (err.response?.status === 404) {
      return res.status(404).json({ success: false, message: 'Template tidak ditemukan di Listmonk.' });
    }

    const listmonkMsg = err.response?.data?.message || err.message;
    return res.status(503).json({
      success: false,
      message: `Listmonk error: ${listmonkMsg}`,
    });
  }
});

/**
 * GET /api/listmonk/campaigns
 * Ambil semua campaign dari Listmonk.
 */
router.get('/campaigns', requireAuth, async (req, res) => {
  try {
    const campaigns = await getCampaigns();
    return res.json({ campaigns });
  } catch (err) {
    console.error('[Listmonk] Get campaigns error:', err.message);
    return res.status(503).json({
      success: false,
      message: 'Tidak dapat mengambil daftar campaign dari Listmonk.',
    });
  }
});

/**
 * GET /api/listmonk/campaigns/:id/analytics
 * Ambil analytics lengkap (per-subscriber views + clicks) untuk satu campaign.
 * Ini adalah blocking request — bisa memakan waktu tergantung jumlah subscriber.
 */
router.get('/campaigns/:id/analytics', requireAuth, async (req, res) => {
  const campaignId = parseInt(req.params.id, 10);
  if (!campaignId || isNaN(campaignId)) {
    return res.status(400).json({ success: false, message: 'Campaign ID tidak valid.' });
  }

  try {
    const analytics = await getCampaignAnalytics(campaignId);
    return res.json({ success: true, data: analytics });
  } catch (err) {
    console.error('[Listmonk] Get campaign analytics error:', err.message);
    if (err.response?.status === 404) {
      return res.status(404).json({ success: false, message: 'Campaign tidak ditemukan.' });
    }
    const listmonkMsg = err.response?.data?.message || err.message;
    return res.status(503).json({
      success: false,
      message: `Gagal mengambil analytics: ${listmonkMsg}`,
    });
  }
});

module.exports = router;
