import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const TEMPLATE_TYPES = [
  { value: 'campaign', label: 'Campaign (HTML)' },
  { value: 'campaign_visual', label: 'Visual (drag-drop)' },
];

const SaveModal = ({ isOpen, onClose, onSuccess }) => {
  const { currentHtml, addToast } = useApp();
  const [action, setAction] = useState('create'); // 'create' | 'update'
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('campaign');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await axios.get('/api/listmonk/templates');
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (action === 'create' && !templateName.trim()) {
      setError('Nama template wajib diisi.');
      return;
    }
    if (action === 'update' && !selectedTemplateId) {
      setError('Pilih template yang akan diupdate.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        action,
        templateName: action === 'update'
          ? templates.find(t => String(t.id) === String(selectedTemplateId))?.name || templateName
          : templateName.trim(),
        templateType,
        html: currentHtml,
        ...(action === 'update' && { templateId: Number(selectedTemplateId) }),
      };

      const res = await axios.post('/api/listmonk/templates/save', payload);
      addToast('✓ Template berhasil disimpan ke Listmonk!', 'success');
      onSuccess(res.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan template.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        style={{ backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-400">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            Simpan Template ke Listmonk
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Action selector */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Pilih aksi:</label>
            <div className="space-y-2">
              {[
                { val: 'update', label: 'Update template yang sudah ada' },
                { val: 'create', label: 'Buat template baru' },
              ].map(({ val, label }) => (
                <label key={val} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${action === val ? 'border-brand-500' : 'border-white/30 group-hover:border-white/50'}`}>
                    {action === val && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                  </div>
                  <input type="radio" className="hidden" value={val} checked={action === val} onChange={() => setAction(val)} />
                  <span className={`text-sm transition-colors ${action === val ? 'text-white' : 'text-white/50 group-hover:text-white/70'}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Update: dropdown */}
          {action === 'update' && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-white/60 mb-2">Pilih template:</label>
              {loadingTemplates ? (
                <div className="input-field flex items-center gap-2 text-white/40">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  Memuat daftar template...
                </div>
              ) : (
                <select
                  id="select-template"
                  className="input-field cursor-pointer"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <option value="">-- Pilih template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id} style={{ background: '#1a1a2e' }}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Create: nama + tipe */}
          {action === 'create' && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Nama template:</label>
                <input
                  id="input-template-name"
                  type="text"
                  className="input-field"
                  placeholder="Contoh: Promo Mei 2026"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Tipe:</label>
                <div className="flex gap-3">
                  {TEMPLATE_TYPES.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer group">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${templateType === value ? 'border-brand-500' : 'border-white/30'}`}>
                        {templateType === value && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                      </div>
                      <input type="radio" className="hidden" value={value} checked={templateType === value} onChange={() => setTemplateType(value)} />
                      <span className={`text-xs transition-colors ${templateType === value ? 'text-white' : 'text-white/50'}`}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button id="btn-modal-cancel" className="btn-secondary px-5" onClick={onClose}>
              Batal
            </button>
            <button
              id="btn-modal-save"
              className="btn-primary px-6"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                  </svg>
                  Simpan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveModal;
