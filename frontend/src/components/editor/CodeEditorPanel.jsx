import React, { useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';

const CodeEditorPanel = ({ html, onChange }) => {
  const editorRef = useRef(null);
  const debounceRef = useRef(null);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  const handleChange = useCallback((value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(value || '');
    }, 500); // 500ms debounce
  }, [onChange]);

  const handleFormat = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(html);
    } catch (_) {}
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/50">CODE EDITOR</span>
          <span className="badge bg-white/5 text-white/30 border border-white/10 text-xs">HTML</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-format-html"
            onClick={handleFormat}
            className="btn-secondary px-3 py-1 text-xs"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            Format HTML
          </button>
          <button
            id="btn-copy-html"
            onClick={handleCopy}
            className="btn-secondary px-3 py-1 text-xs"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Salin
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="html"
          value={html}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            tabSize: 2,
            formatOnPaste: true,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          }}
          loading={
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        />
      </div>
    </div>
  );
};

export default CodeEditorPanel;
