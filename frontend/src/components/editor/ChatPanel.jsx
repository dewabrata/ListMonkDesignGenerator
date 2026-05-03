import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';

const ChatPanel = ({ isOpen, onToggle }) => {
  const { chatHistory, setChatHistory, currentHtml, updateHtmlFromChat,
          generatedAssets, styleDescriptor, canUndo, undo, addToast } = useApp();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isOpen]);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMsg = { role: 'user', content: message.trim() };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setMessage('');
    setLoading(true);

    try {
      const res = await axios.post('/api/chat/revise', {
        userMessage: userMsg.content,
        currentHtml,
        history: chatHistory,
        generatedAssets,
        styleDescriptor,
      });

      const { revisedHtml, assistantMessage, updatedAssets } = res.data;

      // Update HTML (simpan snapshot untuk undo)
      updateHtmlFromChat(revisedHtml, updatedAssets || null);

      const aiMsg = { role: 'assistant', content: assistantMessage };
      setChatHistory([...newHistory, aiMsg]);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'AI gagal memproses permintaan.';
      setChatHistory([...newHistory, { role: 'assistant', content: `❌ ${errMsg}` }]);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col border-t border-white/5 transition-all duration-300 ${isOpen ? 'h-72' : 'h-12'}`}>
      {/* Toggle header */}
      <button
        id="btn-toggle-chat"
        className="flex items-center justify-between px-4 py-3 text-white/60 hover:text-white transition-colors w-full flex-shrink-0"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-sm font-medium">Chat Revisor AI</span>
          {chatHistory.length > 0 && (
            <span className="badge-purple text-xs">{Math.floor(chatHistory.length / 2)} revisi</span>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>

      {/* Chat content */}
      {isOpen && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-white/40 text-sm">Ketik instruksi untuk merevisi template...</p>
                <p className="text-white/25 text-xs mt-1">Contoh: "Ubah tombol menjadi warna merah"</p>
              </div>
            ) : (
              chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="chat-bubble-ai flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-white/40 text-xs">AI sedang berpikir...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-white/5 flex items-end gap-2 flex-shrink-0">
            {/* Undo button */}
            {canUndo && (
              <button
                id="btn-undo"
                className="btn-secondary px-3 py-2 text-xs flex-shrink-0 gap-1"
                onClick={undo}
                title="Undo perubahan terakhir dari AI"
              >
                ↩ Undo
              </button>
            )}

            <textarea
              ref={textareaRef}
              id="chat-input"
              className="input-field flex-1 resize-none text-sm py-2.5 min-h-[40px] max-h-[100px]"
              placeholder="Ketik instruksi revisi... (Enter untuk kirim, Shift+Enter untuk baris baru)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
              style={{ height: 'auto' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
              }}
            />

            <button
              id="btn-chat-send"
              className="btn-primary px-4 py-2 text-sm flex-shrink-0"
              onClick={sendMessage}
              disabled={!message.trim() || loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
