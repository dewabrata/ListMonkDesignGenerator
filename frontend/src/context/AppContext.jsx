import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  // ── Navigation ──
  const [currentPage, setCurrentPage] = useState('analytics'); // 'analytics' | 'upload' | 'processing' | 'editor'

  // ── Job state ──
  const [jobId, setJobId] = useState(null);
  const [processingStatus, setProcessingStatus] = useState({
    step: 0,
    totalSteps: 7,
    message: '',
    imageGenProgress: null,
  });

  // ── Editor state ──
  const [currentHtml, setCurrentHtml] = useState('');
  const [previousHtml, setPreviousHtml] = useState(null); // 1-level undo
  const [detectedVariables, setDetectedVariables] = useState([]);
  const [generatedAssets, setGeneratedAssets] = useState([]);
  const [styleDescriptor, setStyleDescriptor] = useState('');
  const [canUndo, setCanUndo] = useState(false);

  // ── Chat state ──
  const [chatHistory, setChatHistory] = useState([]); // { role: 'user'|'assistant', content: string }[]

  // ── Toast ──
  const [toasts, setToasts] = useState([]);

  // ── Actions ──

  const navigateTo = useCallback((page) => setCurrentPage(page), []);

  const startProcessing = useCallback((id) => {
    setJobId(id);
    setCurrentPage('processing');
  }, []);

  const onPipelineComplete = useCallback((result) => {
    setCurrentHtml(result.html);
    setPreviousHtml(null);
    setCanUndo(false);
    setDetectedVariables(result.detectedVariables || []);
    setGeneratedAssets(result.generatedAssets || []);
    setStyleDescriptor(result.styleDescriptor || '');
    setChatHistory([]);
    setCurrentPage('editor');
  }, []);

  const updateHtmlFromChat = useCallback((newHtml, updatedAssets) => {
    setPreviousHtml(currentHtml); // snapshot untuk undo
    setCurrentHtml(newHtml);
    setCanUndo(true);
    if (updatedAssets) setGeneratedAssets(updatedAssets);
  }, [currentHtml]);

  const undo = useCallback(() => {
    if (previousHtml !== null) {
      setCurrentHtml(previousHtml);
      setPreviousHtml(null);
      setCanUndo(false);
    }
  }, [previousHtml]);

  const resetToUpload = useCallback(() => {
    setCurrentPage('upload');
    setJobId(null);
    setCurrentHtml('');
    setPreviousHtml(null);
    setCanUndo(false);
    setDetectedVariables([]);
    setGeneratedAssets([]);
    setStyleDescriptor('');
    setChatHistory([]);
    setProcessingStatus({ step: 0, totalSteps: 7, message: '', imageGenProgress: null });
  }, []);

  // Toast helpers
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = {
    // State
    currentPage,
    jobId,
    processingStatus,
    currentHtml,
    previousHtml,
    detectedVariables,
    generatedAssets,
    styleDescriptor,
    canUndo,
    chatHistory,
    toasts,
    // Actions
    navigateTo,
    startProcessing,
    onPipelineComplete,
    setProcessingStatus,
    setCurrentHtml,
    updateHtmlFromChat,
    undo,
    resetToUpload,
    setChatHistory,
    addToast,
    removeToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
