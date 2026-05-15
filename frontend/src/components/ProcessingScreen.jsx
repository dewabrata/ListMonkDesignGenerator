import React, { useEffect, useRef } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';

const STEPS = [
  { step: 1, label: 'Mengunggah gambar' },
  { step: 2, label: 'Menganalisis desain dan mengidentifikasi elemen' },
  { step: 3, label: 'Memotong aset brand dari mockup' },
  { step: 4, label: 'Membuat ilustrasi baru dengan AI' },
  { step: 5, label: 'Mengunggah semua aset ke Listmonk' },
  { step: 6, label: 'Merakit kode HTML template' },
  { step: 7, label: 'Selesai! Template siap direview' },
];

const ProcessingScreen = () => {
  const { jobId, processingStatus, setProcessingStatus, onPipelineComplete, resetToUpload, addToast } = useApp();
  const pollRef = useRef(null);
  const failRef = useRef(false);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      if (failRef.current) return;
      try {
        const res = await axios.get(`/api/process/${jobId}/status`);
        const data = res.data;

        setProcessingStatus({
          step: data.currentStep || 0,
          totalSteps: data.totalSteps || 7,
          message: data.stepMessage || '',
          imageGenProgress: data.imageGenProgress || null,
        });

        if (data.status === 'completed' && data.result) {
          clearInterval(pollRef.current);
          onPipelineComplete(data.result);
          return;
        }

        if (data.status === 'failed') {
          clearInterval(pollRef.current);
          failRef.current = true;
          setProcessingStatus((prev) => ({
            ...prev,
            message: data.error || 'Pipeline gagal. Silakan coba lagi.',
            failed: true,
          }));
        }
      } catch (err) {
        console.error('[Polling] Error:', err.message);
      }
    };

    poll(); // immediate first poll
    pollRef.current = setInterval(poll, 2000);

    return () => clearInterval(pollRef.current);
  }, [jobId]);

  const { step, totalSteps, message, imageGenProgress, failed } = processingStatus;
  const progressPct = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 pt-20">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-600/15 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg animate-fade-in">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          {failed ? (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-red-500/10 border border-red-500/30">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
          ) : (
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, rgba(118,96,250,0.2), rgba(90,47,212,0.2))', border: '1px solid rgba(118,96,250,0.4)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-400 animate-spin-slow">
                  <path d="M12 2a10 10 0 0 1 10 10"/>
                  <path d="M12 6a6 6 0 0 1 6 6"/>
                  <circle cx="12" cy="12" r="2" fill="currentColor"/>
                </svg>
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-2xl animate-ping opacity-20"
                   style={{ background: 'linear-gradient(135deg, #7660fa, #5a2fd4)' }} />
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          {failed ? 'Pipeline Gagal' : 'Memproses Desain...'}
        </h1>
        <p className="text-center text-white/50 text-sm mb-8">
          {failed ? 'Terjadi kesalahan. Silakan coba lagi.' : 'Estimasi waktu: 30–90 detik'}
        </p>

        {/* Progress bar */}
        {!failed && (
          <div className="mb-8">
            <div className="flex justify-between text-xs text-white/40 mb-2">
              <span>Progres</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #7660fa, #a78bfa)',
                  boxShadow: '0 0 10px rgba(118,96,250,0.5)',
                }}
              />
            </div>
          </div>
        )}

        {/* Steps list */}
        <div className="glass-card p-6 space-y-4">
          {STEPS.map(({ step: s, label }) => {
            const isDone = step > s;
            const isActive = step === s && !failed;
            const isPending = step < s;

            return (
              <div key={s} className="step-item">
                {/* Dot */}
                {isDone ? (
                  <div className="step-dot-done">✓</div>
                ) : isActive ? (
                  <div className="step-dot-active">
                    <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="step-dot-pending">{s}</div>
                )}

                {/* Label */}
                <div className="flex-1 pt-1">
                  <p className={`text-sm font-medium transition-colors ${
                    isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-white/30'
                  }`}>
                    {label}
                    {/* Image gen counter */}
                    {isActive && s === 4 && imageGenProgress && (
                      <span className="ml-2 badge-purple">
                        {imageGenProgress.current}/{imageGenProgress.total}
                      </span>
                    )}
                  </p>
                  {isActive && message && s !== 4 && (
                    <p className="text-xs text-white/40 mt-0.5">{message}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error / restart */}
        {failed && (
          <div className="mt-6 text-center animate-fade-in">
            <p className="text-red-400 text-sm mb-4">{message}</p>
            <button id="btn-retry" className="btn-primary" onClick={resetToUpload}>
              ↩ Upload Ulang
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessingScreen;
