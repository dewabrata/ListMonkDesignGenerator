import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Parse HTML sections berdasarkan data-section-id ──
export const parseHtmlSections = (html) => {
  const sections = [];
  const regex = /<!--\s*SECTION:\s*(\S+)\s*-->[\s\S]*?(<table[^>]*data-section-id="([^"]*)"[^>]*>[\s\S]*?<\/table>)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const commentId = match[1];
    const tableHtml = match[2];
    const tableId = match[3];
    const labelMatch = tableHtml.match(/data-section-label="([^"]*)"/i);
    sections.push({
      id: tableId || commentId,
      label: labelMatch ? labelMatch[1] : tableId || commentId,
      html: `<!-- SECTION: ${commentId} -->\n${tableHtml}`,
    });
  }
  return sections;
};

// ── Rebuild HTML dari array sections ──
export const rebuildHtml = (originalHtml, sections) => {
  // Ambil bagian sebelum section pertama dan sesudah section terakhir
  const firstSectionStart = originalHtml.search(/<!--\s*SECTION:/i);
  const prefix = firstSectionStart > 0 ? originalHtml.substring(0, firstSectionStart) : '';

  // Cari akhir section terakhir
  let lastEnd = 0;
  const regex = /(<table[^>]*data-section-id="[^"]*"[\s\S]*?<\/table>)/gi;
  let m;
  while ((m = regex.exec(originalHtml)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  const suffix = lastEnd > 0 ? originalHtml.substring(lastEnd) : '';

  return prefix + sections.map((s) => s.html).join('\n\n') + suffix;
};

// ── Sortable Section Block ──
const SortableBlock = ({ section, isFooter, activeId }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, disabled: isFooter });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div className={`section-block ${isDragging ? 'is-dragging' : ''} ${isFooter ? 'cursor-not-allowed' : ''}`}>
        {/* Drag handle */}
        {!isFooter && (
          <div
            {...attributes}
            {...listeners}
            className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center
                       opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing
                       text-white/30 hover:text-brand-400 z-10"
          >
            <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor">
              <circle cx="4" cy="4" r="2"/><circle cx="8" cy="4" r="2"/>
              <circle cx="4" cy="10" r="2"/><circle cx="8" cy="10" r="2"/>
              <circle cx="4" cy="16" r="2"/><circle cx="8" cy="16" r="2"/>
            </svg>
          </div>
        )}

        {/* Section label */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {isFooter && (
            <span className="badge bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs">
              🔒 Footer (terkunci)
            </span>
          )}
          {!isFooter && (
            <span className="badge-purple text-xs">{section.label}</span>
          )}
        </div>

        {/* Preview iframe */}
        <div className="pl-6 overflow-hidden rounded-lg">
          <iframe
            srcDoc={`
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { margin: 0; padding: 4px; background: transparent; }
                  img[data-regeneratable="true"] { position: relative; }
                </style>
              </head>
              <body>${section.html}</body>
              </html>
            `}
            className="w-full border-0 pointer-events-none"
            style={{ minHeight: '60px', height: 'auto' }}
            scrolling="no"
            title={`section-${section.id}`}
            onLoad={(e) => {
              try {
                const h = e.target.contentDocument?.body?.scrollHeight;
                if (h) e.target.style.height = h + 'px';
              } catch (_) {}
            }}
          />
        </div>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ──
const PreviewPanel = ({ html, onHtmlChange, viewMode, onViewModeChange }) => {
  const [sections, setSections] = useState([]);
  const [parseError, setParseError] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Parse sections ketika html berubah
  useEffect(() => {
    const parsed = parseHtmlSections(html);
    if (parsed.length === 0 && html.length > 100) {
      setParseError(true);
      setSections([]);
    } else {
      setParseError(false);
      setSections(parsed);
    }
  }, [html]);

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const footerId = sections.find(s => s.id === 'footer')?.id;

    setSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);

      // Tidak boleh pindah ke setelah footer
      if (over.id === footerId) return prev;

      const reordered = arrayMove(prev, oldIdx, newIdx);

      // Pastikan footer selalu di akhir
      const footerSection = reordered.find(s => s.id === 'footer');
      if (footerSection) {
        const withoutFooter = reordered.filter(s => s.id !== 'footer');
        const final = [...withoutFooter, footerSection];
        const newHtml = rebuildHtml(html, final);
        onHtmlChange(newHtml);
        return final;
      }

      const newHtml = rebuildHtml(html, reordered);
      onHtmlChange(newHtml);
      return reordered;
    });
  };

  const activeSection = activeId ? sections.find(s => s.id === activeId) : null;

  // Jika parse error, tampilkan full preview
  if (parseError || sections.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 flex-shrink-0">
          <span className="text-xs font-medium text-white/50">PREVIEW</span>
          <div className="flex items-center gap-2">
            {parseError && (
              <span className="badge-yellow text-xs">⚠ Drag & drop tidak tersedia</span>
            )}
            <ViewToggle viewMode={viewMode} onChange={onViewModeChange} />
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-white/5 rounded-b-xl flex items-start justify-center p-4">
          <iframe
            srcDoc={html}
            className="border-0 rounded-lg shadow-2xl"
            style={{ width: viewMode === 'mobile' ? '320px' : '600px', minHeight: '400px', height: '100%' }}
            title="preview"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/50">PREVIEW</span>
          <span className="badge-purple text-xs">{sections.length} sections</span>
        </div>
        <ViewToggle viewMode={viewMode} onChange={onViewModeChange} />
      </div>

      {/* Sortable blocks */}
      <div className="flex-1 overflow-auto p-4 space-y-2"
           style={{ maxWidth: viewMode === 'mobile' ? '360px' : '640px', margin: '0 auto', width: '100%' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <SortableBlock
                key={section.id}
                section={section}
                isFooter={section.id === 'footer'}
                activeId={activeId}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeSection && (
              <div className="glass-card p-2 opacity-90 shadow-2xl border-brand-500/50">
                <p className="text-xs text-brand-300 font-medium px-2 py-1">{activeSection.label}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

const ViewToggle = ({ viewMode, onChange }) => (
  <div className="flex items-center bg-white/5 rounded-lg p-0.5">
    <button
      id="btn-view-desktop"
      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'desktop' ? 'bg-brand-600 text-white' : 'text-white/40 hover:text-white/70'}`}
      onClick={() => onChange('desktop')}
    >
      Desktop
    </button>
    <button
      id="btn-view-mobile"
      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'mobile' ? 'bg-brand-600 text-white' : 'text-white/40 hover:text-white/70'}`}
      onClick={() => onChange('mobile')}
    >
      Mobile
    </button>
  </div>
);

export default PreviewPanel;
