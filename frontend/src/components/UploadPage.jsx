import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

const UploadPage = () => {
  const { startProcessing, addToast } = useApp();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const validateFile = (f) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return 'Format tidak didukung. Gunakan JPG atau PNG.';
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `Ukuran file terlalu besar. Maksimum ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFile = useCallback((f) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      setPreview(null);
      return;
    }
    setError('');
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleInputChange = (e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      startProcessing(res.data.jobId);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mengunggah file. Coba lagi.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #7660fa, #5a2fd4)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span className="font-semibold text-white">Listmonk Generator</span>
        </div>
        <button
          id="btn-logout"
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
          onClick={() => { axios.post('/api/auth/logout').then(() => window.location.reload()); }}
        >
          Logout
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full">
        {/* Hero text */}
        <div className="text-center mb-12 animate-slide-up">
          <h1 className="text-4xl font-bold text-gradient mb-3">Upload Desain Email</h1>
          <p className="text-white/50 text-lg max-w-xl">
            Upload mockup email Anda (JPG/PNG) dan AI akan mengkonversinya menjadi kode HTML template Listmonk secara otomatis.
          </p>
        </div>

        {/* Dropzone */}
        <div className="w-full animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div
            id="upload-dropzone"
            className={`dropzone p-12 flex flex-col items-center justify-center min-h-64 ${dragOver ? 'drag-over' : ''} ${file ? 'border-brand-500/40' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            {!file ? (
              <>
                {/* Upload icon */}
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 ${dragOver ? 'scale-110' : ''}`}
                     style={{ background: 'rgba(118, 96, 250, 0.1)', border: '1px solid rgba(118, 96, 250, 0.3)' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-400">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <p className="text-white/70 font-medium mb-1">
                  {dragOver ? 'Lepaskan file di sini' : 'Drag & drop file di sini'}
                </p>
                <p className="text-white/40 text-sm mb-4">atau klik untuk browse</p>
                <div className="flex gap-2">
                  <span className="badge-purple">JPG</span>
                  <span className="badge-purple">PNG</span>
                  <span className="badge bg-white/10 text-white/50 border border-white/10">Max 10MB</span>
                </div>
              </>
            ) : (
              /* File preview */
              <div className="flex items-start gap-6 w-full" onClick={(e) => e.stopPropagation()}>
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-32 h-24 rounded-xl overflow-hidden border border-white/10">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-green">✓ Siap diproses</span>
                  </div>
                  <p className="font-medium text-white truncate">{file.name}</p>
                  <p className="text-white/50 text-sm mt-1">{formatSize(file.size)}</p>
                  <button
                    className="text-white/40 hover:text-red-400 text-sm mt-3 transition-colors"
                    onClick={() => { setFile(null); setPreview(null); fileInputRef.current.value = ''; }}
                  >
                    Hapus file
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={handleInputChange}
              disabled={uploading}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-fade-in">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Process button */}
        <div className="mt-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <button
            id="btn-process"
            className="btn-primary px-10 py-4 text-base"
            onClick={handleProcess}
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Mengunggah...
              </>
            ) : (
              <>
                Proses dengan AI
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-4 mt-16 w-full animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {[
            { icon: '🔍', title: 'Analisis Visual', desc: 'AI mengidentifikasi semua elemen desain secara otomatis' },
            { icon: '🎨', title: 'Generate Ilustrasi', desc: 'Gambar placeholder di-generate ulang dengan gaya konsisten' },
            { icon: '💾', title: 'Simpan ke Listmonk', desc: 'Template langsung tersimpan ke server Listmonk Anda' },
          ].map((card, i) => (
            <div key={i} className="glass-card p-5 text-center">
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-white text-sm mb-1">{card.title}</h3>
              <p className="text-white/40 text-xs">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default UploadPage;
