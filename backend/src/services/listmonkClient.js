const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const { htmlToVisualTemplate } = require('./htmlToVisualConverter');

/**
 * Build authorization header untuk Listmonk API.
 * Default: token auth. Fallback: BasicAuth jika LISTMONK_USE_BASIC_AUTH=true
 */
const getAuthHeader = () => {
  const apiUser = process.env.LISTMONK_API_USER;
  const apiToken = process.env.LISTMONK_API_TOKEN;

  if (process.env.LISTMONK_USE_BASIC_AUTH === 'true') {
    const encoded = Buffer.from(`${apiUser}:${apiToken}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }

  return { Authorization: `token ${apiUser}:${apiToken}` };
};

const getBaseURL = () => {
  const base = process.env.LISTMONK_BASE_URL || '';
  return base.replace(/\/$/, ''); // remove trailing slash
};

/**
 * Upload file media ke Listmonk.
 * @param {string} filePath - path file lokal
 * @param {string} filename - nama file yang akan dipakai di Listmonk
 * @returns {Promise<{ id, uuid, url }>}
 */
const uploadMedia = async (filePath, filename) => {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { filename });

  const response = await axios.post(
    `${getBaseURL()}/api/media`,
    form,
    {
      headers: {
        ...getAuthHeader(),
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  const data = response.data?.data;
  if (!data?.url) {
    throw new Error('Listmonk upload media tidak mengembalikan URL.');
  }

  // Listmonk may return internal URLs (e.g. http://localhost:9000/uploads/...).
  // Replace with public base URL so images are accessible externally.
  let publicUrl = data.url;
  const uploadsPath = '/uploads/';
  const uploadsIdx = publicUrl.indexOf(uploadsPath);
  if (uploadsIdx !== -1) {
    publicUrl = getBaseURL() + publicUrl.substring(uploadsIdx);
  }

  return {
    id: data.id,
    uuid: data.uuid,
    url: publicUrl,
  };
};

/**
 * Ambil daftar template dari Listmonk.
 * @returns {Promise<Array<{ id, name, type }>>}
 */
const getTemplates = async () => {
  const response = await axios.get(
    `${getBaseURL()}/api/templates`,
    { headers: getAuthHeader() }
  );

  const templates = response.data?.data?.results || response.data?.data || [];
  return templates.map((t) => ({ id: t.id, name: t.name, type: t.type }));
};

/**
 * Inject content placeholder jika belum ada.
 */
const ensureContentPlaceholder = (html) => {
  if (html.includes('{{ template "content" . }}')) return html;
  return html.replace(
    '</body>',
    '<!-- Listmonk content placeholder -->{{ template "content" . }}</body>'
  );
};

/**
 * Buat template baru di Listmonk.
 * @param {string} name
 * @param {string} type - 'campaign' | 'campaign_visual' | 'tx'
 * @param {string} body - HTML content
 * @returns {Promise<{ id, name }>}
 */
const createTemplate = async (name, type, body) => {
  let payload = { name, type, is_default: false };

  if (type === 'campaign_visual') {
    // Konversi HTML ke visual blocks JSON
    const { bodySource } = await htmlToVisualTemplate(body);
    const htmlWithPlaceholder = ensureContentPlaceholder(body);
    payload.body = htmlWithPlaceholder;
    payload.body_source = bodySource;
  } else {
    payload.body = type === 'campaign' ? ensureContentPlaceholder(body) : body;
  }

  const response = await axios.post(
    `${getBaseURL()}/api/templates`,
    payload,
    { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
  );

  const data = response.data?.data;
  return { id: data.id, name: data.name };
};

/**
 * Update template existing di Listmonk.
 * @param {number} id
 * @param {string} name
 * @param {string} type
 * @param {string} body
 * @returns {Promise<{ id, name }>}
 */
const updateTemplate = async (id, name, type, body) => {
  let payload = { name, type };

  if (type === 'campaign_visual') {
    const { bodySource } = await htmlToVisualTemplate(body);
    const htmlWithPlaceholder = ensureContentPlaceholder(body);
    payload.body = htmlWithPlaceholder;
    payload.body_source = bodySource;
  } else {
    payload.body = type === 'campaign' ? ensureContentPlaceholder(body) : body;
  }

  const response = await axios.put(
    `${getBaseURL()}/api/templates/${id}`,
    payload,
    { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
  );

  const data = response.data?.data;
  return { id: data.id, name: data.name };
};

/**
 * Ambil semua campaign dari Listmonk (semua halaman).
 * @returns {Promise<Array>}
 */
const getCampaigns = async () => {
  const perPage = 100;
  let page = 1;
  let all = [];

  while (true) {
    const response = await axios.get(`${getBaseURL()}/api/campaigns`, {
      headers: getAuthHeader(),
      params: { page, per_page: perPage },
    });
    const data = response.data?.data;
    const results = data?.results || [];
    all = all.concat(results);
    if (all.length >= (data?.total || 0) || results.length === 0) break;
    page++;
  }

  return all.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    status: c.status,
    sent: c.sent,
    to_send: c.to_send,
    views: c.views,
    clicks: c.clicks,
    created_at: c.created_at,
  }));
};

/**
 * Ambil tracked URLs untuk campaign tertentu.
 * @param {number} campaignId
 * @returns {Promise<string[]>}
 */
const getCampaignUrls = async (campaignId) => {
  try {
    const response = await axios.get(`${getBaseURL()}/api/campaigns/analytics/links`, {
      headers: getAuthHeader(),
      params: { id: campaignId, from: '2020-01-01', to: '2030-01-01' },
    });
    return (response.data?.data || []).map((item) => item.url || '');
  } catch {
    return [];
  }
};

/**
 * Ambil semua subscriber (semua halaman).
 * @returns {Promise<Array>}
 */
const getAllSubscribers = async () => {
  const perPage = 100;
  let page = 1;
  let all = [];

  while (true) {
    const response = await axios.get(`${getBaseURL()}/api/subscribers`, {
      headers: getAuthHeader(),
      params: { page, per_page: perPage },
    });
    const data = response.data?.data;
    const results = data?.results || [];
    all = all.concat(results);
    if (all.length >= (data?.total || 0) || results.length === 0) break;
    page++;
  }

  return all;
};

/**
 * Export aktivitas subscriber.
 * @param {number} subscriberId
 * @returns {Promise<Object>}
 */
const exportSubscriber = async (subscriberId) => {
  const response = await axios.get(`${getBaseURL()}/api/subscribers/${subscriberId}/export`, {
    headers: getAuthHeader(),
  });
  return response.data;
};

/**
 * Ambil analytics lengkap untuk satu campaign.
 * Includes per-subscriber views, matched clicks, dan detail URL per klik.
 * @param {number} campaignId
 * @returns {Promise<Object>}
 */
const getCampaignAnalytics = async (campaignId) => {
  // 1. Info campaign
  const campaignResp = await axios.get(`${getBaseURL()}/api/campaigns/${campaignId}`, {
    headers: getAuthHeader(),
  });
  const campaign = campaignResp.data?.data;

  // 2. Tracked URLs
  const urls = await getCampaignUrls(campaignId);
  const urlsSet = new Set(urls);

  const normUrl = (u) => (u ? u.replace(/&amp;/g, '&').trim() : '');
  const normalizedUrlsSet = new Set([...urlsSet].map(normUrl));

  // 3. Semua subscriber
  const subscribers = await getAllSubscribers();

  // 4. Per-subscriber activity (sequential — tidak perlu parallel di Node)
  const subscriberResults = [];
  for (const sub of subscribers) {
    try {
      const data = await exportSubscriber(sub.id);

      const viewRecords = (data.campaign_views || []).filter(
        (v) => v.campaign === campaign.subject
      );
      const totalViews = viewRecords.reduce((sum, v) => sum + (v.views || 0), 0);

      const allClicks = data.link_clicks || [];
      const matchedClicks = allClicks.filter(
        (c) => normalizedUrlsSet.has(normUrl(c.url))
      );
      const totalMatchedClicks = matchedClicks.reduce((sum, c) => sum + (c.clicks || 0), 0);
      const totalAllClicks = allClicks.reduce((sum, c) => sum + (c.clicks || 0), 0);

      subscriberResults.push({
        id: sub.id,
        email: sub.email,
        name: sub.name || '',
        status: sub.status,
        totalViews,
        totalMatchedClicks,
        totalAllClicks,
        matchedClicks: matchedClicks.map((c) => ({ url: c.url, clicks: c.clicks || 0 })),
        allClicks: allClicks.map((c) => ({ url: c.url, clicks: c.clicks || 0 })),
      });
    } catch {
      subscriberResults.push({
        id: sub.id,
        email: sub.email,
        name: sub.name || '',
        status: sub.status,
        totalViews: 0,
        totalMatchedClicks: 0,
        totalAllClicks: 0,
        matchedClicks: [],
        allClicks: [],
      });
    }
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      status: campaign.status,
      sent: campaign.sent,
      to_send: campaign.to_send,
      views: campaign.views,
      clicks: campaign.clicks,
      created_at: campaign.created_at,
    },
    trackedUrls: urls,
    subscribers: subscriberResults,
  };
};

module.exports = {
  uploadMedia,
  getTemplates,
  createTemplate,
  updateTemplate,
  getCampaigns,
  getCampaignAnalytics,
};
