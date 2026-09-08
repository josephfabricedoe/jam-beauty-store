import React from 'react';

const PRESETS = [
  { id: 'today',   label: 'Today' },
  { id: 'week',    label: 'This Week' },
  { id: 'month',   label: 'This Month' },
  { id: 'year',    label: 'This Year' },
  { id: 'all',     label: 'All Time (Inc. Imported)' },
  { id: 'custom',  label: 'Custom' },
];

export function getDateRange(preset, customFrom, customTo) {
  const now = new Date();
  const start = new Date(now);

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      const endToday = new Date(now);
      endToday.setHours(23, 59, 59, 999);
      return { from: start, to: endToday };

    case 'week':
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const endWeek = new Date(start);
      endWeek.setDate(start.getDate() + 6);
      endWeek.setHours(23, 59, 59, 999);
      return { from: start, to: endWeek };

    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from: start, to: endMonth };

    case 'year':
      const startYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      const endYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { from: startYear, to: endYear };

    case 'all':
      // From 2020 through future to capture all historical imported sales
      return { from: new Date('2020-01-01T00:00:00Z'), to: new Date('2099-12-31T23:59:59Z') };

    case 'custom':
      const fromD = customFrom ? new Date(customFrom) : start;
      const toD = customTo ? new Date(customTo + 'T23:59:59') : new Date(now.setHours(23, 59, 59, 999));
      return { from: fromD, to: toD };

    default:
      return { from: start, to: now };
  }
}

export default function DateFilterBar({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => (
        <button
          key={p.id}
          onClick={() => setPreset(p.id)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            preset === p.id
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
              : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
          }`}
        >
          {p.label}
        </button>
      ))}

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-rose-400"
          />
          <span className="text-slate-500">—</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-rose-400"
          />
        </div>
      )}
    </div>
  );
}
