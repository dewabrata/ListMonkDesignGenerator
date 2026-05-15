import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useApp } from '../context/AppContext';
import PreviewPanel from './editor/PreviewPanel';
import CodeEditorPanel from './editor/CodeEditorPanel';
import ChatPanel from './editor/ChatPanel';
import SaveModal from './SaveModal';

const EditorPage = () => {
  const { currentHtml, setCurrentHtml, detectedVariables, resetToUpload, addToast } = useApp();

  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [chatOpen, setChatOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // percent for left panel

  // Preview → Editor sync (from drag & drop reorder)
  const handlePreviewChange = useCallback((newHtml) => {
    setCurrentHtml(newHtml);
  }, [setCurrentHtml]);

  // Editor → Preview sync (from Monaco edit, debounced)
  const handleEditorChange = useCallback((newHtml) => {
    setCurrentHtml(newHtml);
  }, [setCurrentHtml]);

  const handleLogout = () => {
    axios.post('/api/auth/logout').then(() => window.location.reload());
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pt-12">
      {/* ── TOP TOOLBAR ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-surface-950/80" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: 'linear-gradient(135deg, #7660fa, #5a2fd4)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span className="font-semibold text-white text-sm">Listmonk Generator</span>

          {/* Go Template vars badge */}
          {detectedVariables.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {detectedVariables.slice(0, 4).map((v, i) => (
                <span key={i} className="badge-purple text-xs font-mono">{v}</span>
              ))}
              {detectedVariables.length > 4 && (
                <span className="text-white/30 text-xs">+{detectedVariables.length - 4} more</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-reset-upload"
            className="btn-secondary px-3 py-1.5 text-xs gap-1.5"
            onClick={resetToUpload}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
            </svg>
            Upload Baru
          </button>

          <button
            id="btn-save-listmonk"
            className="btn-primary px-4 py-1.5 text-sm gap-1.5"
            onClick={() => setSaveModalOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
            </svg>
            Save to Listmonk
          </button>

          <button onClick={handleLogout} className="text-white/30 hover:text-white/60 text-xs transition-colors ml-1">
            Logout
          </button>
        </div>
      </header>

      {/* ── SPLIT VIEW ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Preview Panel */}
        <div className="flex flex-col overflow-hidden border-r border-white/5" style={{ width: `${splitRatio}%` }}>
          <PreviewPanel
            html={currentHtml}
            onHtmlChange={handlePreviewChange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        {/* Divider (draggable — simplified) */}
        <div
          className="w-1 flex-shrink-0 bg-white/5 hover:bg-brand-500/30 cursor-col-resize transition-colors"
          title="Drag untuk resize"
        />

        {/* Right: Code Editor Panel */}
        <div className="flex flex-col overflow-hidden" style={{ width: `${100 - splitRatio}%` }}>
          <CodeEditorPanel
            html={currentHtml}
            onChange={handleEditorChange}
          />
        </div>
      </div>

      {/* ── BOTTOM: CHAT PANEL ── */}
      <div className="flex-shrink-0">
        <ChatPanel
          isOpen={chatOpen}
          onToggle={() => setChatOpen(!chatOpen)}
        />
      </div>

      {/* ── SAVE MODAL ── */}
      <SaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
};

export default EditorPage;
