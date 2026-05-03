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

module.exports = { uploadMedia, getTemplates, createTemplate, updateTemplate };
