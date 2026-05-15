import React, { useState, useMemo } from 'react';

const STATUS_BADGE = {
  draft:     'bg-surface-800 text-surface-300 border border-surface-700',
  scheduled: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800',
  running:   'bg-blue-900/50 text-blue-300 border border-blue-800',
  finished:  'bg-green-900/50 text-green-300 border border-green-800',
  paused:    'bg-orange-900/50 text-orange-300 border border-orange-800',
  cancelled: 'bg-red-900/50 text-red-300 border border-red-800',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtPct = (num, denom) => {
  if (!denom || denom === 0) return '—';
  return `${((num / denom) * 100).toFixed(1)}%`;
};

const SortIcon = ({ col, sortKey, sortDir }) => {
  if (sortKey !== col) {
    return (
      <svg className="w-3 h-3 text-surface-500 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return sortDir === 'asc' ? (
    <svg className="w-3 h-3 text-brand-400 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-3 h-3 text-brand-400 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
};

const COLUMNS = [
  { key: 'name',       label: 'Name',       sortable: true  },
  { key: 'subject',    label: 'Subject',    sortable: true  },
  { key: 'status',     label: 'Status',     sortable: true  },
  { key: 'sent',       label: 'Sent',       sortable: true  },
  { key: 'views',      label: 'Views',      sortable: true  },
  { key: 'clicks',     label: 'Clicks',     sortable: true  },
  { key: 'open_rate',  label: 'Open Rate',  sortable: false },
  { key: 'click_rate', label: 'Click Rate', sortable: false },
  { key: 'created_at', label: 'Date',       sortable: true  },
];

const CampaignTable = ({ campaigns, onSelect }) => {
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return campaigns.filter(
      (c) =>
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q)
    );
  }, [campaigns, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (sortKey === 'created_at') {
        va = new Date(va || 0).getTime();
        vb = new Date(vb || 0).getTime();
      } else if (typeof va === 'string') {
        va = va.toLowerCase();
        vb = (vb || '').toLowerCase();
      } else {
        va = va ?? 0;
        vb = vb ?? 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Cari campaign..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-850 border-b border-surface-700">
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
              <th className="px-4 py-3 text-left font-medium text-surface-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-surface-500">
                  Tidak ada campaign ditemukan.
                </td>
              </tr>
            )}
            {sorted.map((c) => (
              <tr
                key={c.id}
                className="border-b border-surface-800 hover:bg-surface-850/60 transition-colors"
              >
                <td className="px-4 py-3 text-white font-medium max-w-[180px] truncate">{c.name}</td>
                <td className="px-4 py-3 text-surface-300 max-w-[220px] truncate">{c.subject}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status] || STATUS_BADGE.draft}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-surface-300 text-right tabular-nums">{c.sent?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-3 text-surface-300 text-right tabular-nums">{c.views?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-3 text-surface-300 text-right tabular-nums">{c.clicks?.toLocaleString() ?? '—'}</td>
                <td className="px-4 py-3 text-surface-300 text-right tabular-nums">{fmtPct(c.views, c.sent)}</td>
                <td className="px-4 py-3 text-surface-300 text-right tabular-nums">{fmtPct(c.clicks, c.sent)}</td>
                <td className="px-4 py-3 text-surface-500 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onSelect(c)}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Analytics
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-surface-500">
        {sorted.length} dari {campaigns.length} campaign
      </p>
    </div>
  );
};

export default CampaignTable;
