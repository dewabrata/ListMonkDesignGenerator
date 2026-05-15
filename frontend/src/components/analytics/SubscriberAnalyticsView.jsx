import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

const fmtPct = (num, denom) => {
  if (!denom || denom === 0) return '—';
  return `${((num / denom) * 100).toFixed(1)}%`;
};

const STATUS_BADGE = {
  enabled:  'bg-green-900/40 text-green-300 border border-green-800',
  disabled: 'bg-red-900/40 text-red-300 border border-red-800',
  blocklisted: 'bg-orange-900/40 text-orange-300 border border-orange-800',
};

const StatCard = ({ label, value, sub }) => (
  <div className="bg-surface-850 border border-surface-700 rounded-xl px-5 py-4 flex flex-col gap-1">
    <span className="text-xs text-surface-500 uppercase tracking-wide">{label}</span>
    <span className="text-2xl font-semibold text-white tabular-nums">{value}</span>
    {sub && <span className="text-xs text-surface-400">{sub}</span>}
  </div>
);

const SortIcon = ({ col, sortKey, sortDir }) => {
  if (sortKey !== col) {
    return <svg className="w-3 h-3 text-surface-500 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>;
  }
  return sortDir === 'asc'
    ? <svg className="w-3 h-3 text-brand-400 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
    : <svg className="w-3 h-3 text-brand-400 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>;
};

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'viewers',  label: 'Viewers only' },
  { key: 'clickers', label: 'Clickers only' },
];

const COLUMNS = [
  { key: 'email',               label: 'Email',       sortable: true  },
  { key: 'name',                label: 'Name',        sortable: true  },
  { key: 'status',              label: 'Status',      sortable: true  },
  { key: 'totalViews',          label: 'Views',       sortable: true  },
  { key: 'totalMatchedClicks',  label: 'Clicks',      sortable: true  },
];

const SubscriberAnalyticsView = ({ data, campaign, onBack }) => {
  const [sortKey, setSortKey] = useState('totalViews');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  const subscribers = data.subscribers || [];
  const totalSent = campaign.sent || 0;
  const totalViewers = subscribers.filter((s) => s.totalViews > 0).length;
  const totalClickers = subscribers.filter((s) => s.totalMatchedClicks > 0).length;
  const totalAllViews = subscribers.reduce((s, r) => s + r.totalViews, 0);
  const totalAllClicks = subscribers.reduce((s, r) => s + r.totalMatchedClicks, 0);

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let list = subscribers;
    if (filter === 'viewers')  list = list.filter((s) => s.totalViews > 0);
    if (filter === 'clickers') list = list.filter((s) => s.totalMatchedClicks > 0);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((s) => s.email?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q));
    return list;
  }, [subscribers, filter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      else { va = va ?? 0; vb = vb ?? 0; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const exportCSV = () => {
    const rows = [
      ['Email', 'Name', 'Status', 'Views', 'Clicks (matched)', 'Clicked URL', 'Click Count'],
    ];
    for (const s of sorted) {
      if (s.matchedClicks.length === 0) {
        rows.push([s.email, s.name, s.status, s.totalViews, s.totalMatchedClicks, '', '']);
      } else {
        s.matchedClicks.forEach((c, i) => {
          rows.push([
            i === 0 ? s.email : '',
            i === 0 ? s.name : '',
            i === 0 ? s.status : '',
            i === 0 ? s.totalViews : '',
            i === 0 ? s.totalMatchedClicks : '',
            c.url,
            c.clicks,
          ]);
        });
      }
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.name}_analytics.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = () => {
    // Sheet 1: summary
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Campaign', campaign.name],
      ['Subject', campaign.subject],
      ['Status', campaign.status],
      ['Sent', totalSent],
      ['Total Views (aggregate)', campaign.views],
      ['Total Clicks (aggregate)', campaign.clicks],
      ['Open Rate', totalSent ? `${((campaign.views / totalSent) * 100).toFixed(1)}%` : '—'],
      ['Click Rate', totalSent ? `${((campaign.clicks / totalSent) * 100).toFixed(1)}%` : '—'],
      ['Unique Viewers (per-sub)', totalViewers],
      ['Unique Clickers (per-sub)', totalClickers],
    ]);

    // Sheet 2: subscriber detail
    const rows = [['Email', 'Name', 'Status', 'Views', 'Clicks (matched)', 'Clicked URL', 'Click Count']];
    for (const s of sorted) {
      if (s.matchedClicks.length === 0) {
        rows.push([s.email, s.name, s.status, s.totalViews, s.totalMatchedClicks, '', '']);
      } else {
        s.matchedClicks.forEach((c, i) => {
          rows.push([
            i === 0 ? s.email : '',
            i === 0 ? s.name : '',
            i === 0 ? s.status : '',
            i === 0 ? s.totalViews : '',
            i === 0 ? s.totalMatchedClicks : '',
            c.url,
            c.clicks,
          ]);
        });
      }
    }
    const detailSheet = XLSX.utils.aoa_to_sheet(rows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Subscribers');
    XLSX.writeFile(wb, `${campaign.name}_analytics.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Kembali
        </button>
        <div className="h-4 w-px bg-surface-700" />
        <div>
          <h2 className="text-white font-semibold">{campaign.name}</h2>
          <p className="text-xs text-surface-500">{campaign.subject}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Sent" value={totalSent.toLocaleString()} />
        <StatCard label="Views" value={campaign.views?.toLocaleString() ?? '—'} sub={`Open rate: ${fmtPct(campaign.views, totalSent)}`} />
        <StatCard label="Clicks" value={campaign.clicks?.toLocaleString() ?? '—'} sub={`Click rate: ${fmtPct(campaign.clicks, totalSent)}`} />
        <StatCard label="Unique Viewers" value={totalViewers.toLocaleString()} sub="per subscriber" />
        <StatCard label="Unique Clickers" value={totalClickers.toLocaleString()} sub="per subscriber" />
        <StatCard label="Total Views/Sub" value={totalAllViews.toLocaleString()} sub={`${totalAllClicks.toLocaleString()} clicks`} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter tabs */}
        <div className="flex bg-surface-850 border border-surface-700 rounded-lg p-0.5 gap-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-brand-600 text-white'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari email atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 bg-surface-850 border border-surface-700 rounded-lg text-xs text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Export buttons */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-800 hover:bg-surface-700 border border-surface-600 text-surface-300 hover:text-white text-xs rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            CSV
          </button>
          <button
            onClick={exportXLSX}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-800 hover:bg-green-700 border border-green-700 text-green-200 text-xs rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Excel
          </button>
        </div>
      </div>

      {/* Subscriber table */}
      <div className="overflow-x-auto rounded-xl border border-surface-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-850 border-b border-surface-700">
              <th className="w-8 px-3 py-3" />
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 text-left font-medium text-surface-400 whitespace-nowrap select-none ${
                    col.sortable ? 'cursor-pointer hover:text-white transition-colors' : ''
                  }`}
                >
                  {col.label}
                  {col.sortable && <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-surface-500">
                  Tidak ada subscriber ditemukan.
                </td>
              </tr>
            )}
            {sorted.map((s) => {
              const isExpanded = expandedRow === s.id;
              const hasClicks = s.matchedClicks.length > 0;
              return (
                <React.Fragment key={s.id}>
                  <tr className={`border-b border-surface-800 transition-colors ${isExpanded ? 'bg-surface-850/80' : 'hover:bg-surface-850/50'}`}>
                    {/* Expand toggle */}
                    <td className="px-3 py-3 text-center">
                      {hasClicks && (
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : s.id)}
                          className="text-surface-500 hover:text-brand-400 transition-colors"
                        >
                          <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs">{s.email}</td>
                    <td className="px-4 py-3 text-surface-300 text-xs">{s.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[s.status] || STATUS_BADGE.disabled}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={s.totalViews > 0 ? 'text-blue-300 font-medium' : 'text-surface-500'}>
                        {s.totalViews}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={s.totalMatchedClicks > 0 ? 'text-green-300 font-medium' : 'text-surface-500'}>
                        {s.totalMatchedClicks}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded: URL detail */}
                  {isExpanded && hasClicks && (
                    <tr className="border-b border-surface-800 bg-surface-900/60">
                      <td colSpan={COLUMNS.length + 1} className="px-6 pb-3 pt-1">
                        <div className="ml-4 flex flex-col gap-1.5">
                          <span className="text-xs text-surface-500 font-medium mb-1">URLs yang diklik:</span>
                          {s.matchedClicks.map((c, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="shrink-0 px-1.5 py-0.5 bg-brand-900/60 text-brand-300 text-xs rounded font-mono">
                                {c.clicks}×
                              </span>
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-surface-400 hover:text-brand-300 break-all transition-colors"
                              >
                                {c.url}
                              </a>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-surface-500">
        {sorted.length} subscriber ditampilkan
      </p>
    </div>
  );
};

export default SubscriberAnalyticsView;
