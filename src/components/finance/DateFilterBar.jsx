import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export const PERIOD_PRESETS = [
  { id: 'today',  label: 'Today' },
  { id: 'week',   label: 'Weekly' },
  { id: 'month',  label: 'Monthly' },
  { id: 'all',    label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

export function getItemDate(item) {
  if (!item) return null;
  if (item.timestamp?.toDate) return item.timestamp.toDate();
  if (item.date?.toDate) return item.date.toDate();
  if (item.timestamp instanceof Date) return item.timestamp;
  if (typeof item.timestamp === 'string') {
    const d = new Date(item.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof item.timestamp === 'number') return new Date(item.timestamp);
  if (typeof item.date === 'string') {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) return d;
  }
  if (item.createdAt?.toDate) return item.createdAt.toDate();
  return null;
}

export function filterItemsByPeriod(items, mode, refDate = new Date(), customFrom = '', customTo = '') {
  if (!Array.isArray(items)) return [];
  if (mode === 'all') return items;

  if (mode === 'custom' && customFrom && customTo) {
    const fromD = new Date(customFrom + 'T00:00:00');
    const toD = new Date(customTo + 'T23:59:59.999');
    return items.filter(item => {
      const d = getItemDate(item);
      return d && d >= fromD && d <= toD;
    });
  }

  const target = new Date(refDate);

  if (mode === 'today') {
    return items.filter(item => {
      const d = getItemDate(item);
      return d &&
        d.getFullYear() === target.getFullYear() &&
        d.getMonth() === target.getMonth() &&
        d.getDate() === target.getDate();
    });
  }

  if (mode === 'week') {
    const startOfWeek = new Date(target);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return items.filter(item => {
      const d = getItemDate(item);
      return d && d >= startOfWeek && d <= endOfWeek;
    });
  }

  if (mode === 'month') {
    return items.filter(item => {
      const d = getItemDate(item);
      return d &&
        d.getFullYear() === target.getFullYear() &&
        d.getMonth() === target.getMonth();
    });
  }

  return items;
}

export function stepPeriodDate(currentDate, mode, offset) {
  const next = new Date(currentDate);
  if (mode === 'today') {
    next.setDate(next.getDate() + offset);
  } else if (mode === 'week') {
    next.setDate(next.getDate() + (offset * 7));
  } else if (mode === 'month') {
    next.setMonth(next.getMonth() + offset);
  }
  return next;
}

export function getPeriodFormattedLabel(mode, selectedDate = new Date(), customFrom = '', customTo = '') {
  const now = new Date();
  const isCurrentDay = selectedDate.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = selectedDate.toDateString() === yesterday.toDateString();

  if (mode === 'today') {
    return isCurrentDay
      ? `Today : ${selectedDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}`
      : isYesterday
        ? `Yesterday : ${selectedDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}`
        : selectedDate.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  if (mode === 'week') {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const nowStart = new Date(now);
    const nowDay = nowStart.getDay();
    nowStart.setDate(nowStart.getDate() - nowDay + (nowDay === 0 ? -6 : 1));
    const isThisWeek = startOfWeek.toDateString() === nowStart.toDateString();

    const prefix = isThisWeek ? 'This Week' : 'Week';
    return `${prefix} : ${startOfWeek.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} - ${endOfWeek.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }

  if (mode === 'month') {
    const isThisMonth = selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
    const prefix = isThisMonth ? 'This Month' : 'Month';
    return `${prefix} : ${selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  }

  if (mode === 'all') {
    return 'All Time (All Recorded Sales)';
  }

  if (mode === 'custom' && customFrom && customTo) {
    return `${customFrom} to ${customTo}`;
  }

  return 'Selected Period';
}

export default function DateFilterBar({
  periodMode,
  setPeriodMode,
  selectedDate,
  setSelectedDate,
  stepDate,
  formattedLabel,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
}) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
      {/* Date Stepper */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => stepDate ? stepDate(-1) : null}
          disabled={periodMode === 'all'}
          className="p-2 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-slate-300 hover:text-white transition-colors"
          title="Previous Period"
        >
          <ChevronLeft className="w-4 h-4 text-[#efaa9b]" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white px-1">
          <Calendar className="w-4 h-4 text-[#efaa9b]" />
          <span>{formattedLabel}</span>
        </div>

        <button
          type="button"
          onClick={() => stepDate ? stepDate(1) : null}
          disabled={periodMode === 'all'}
          className="p-2 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-slate-300 hover:text-white transition-colors"
          title="Next Period"
        >
          <ChevronRight className="w-4 h-4 text-[#efaa9b]" />
        </button>
      </div>

      {/* Period Selection Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {PERIOD_PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodMode(p.id)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              periodMode === p.id
                ? 'bg-[#efaa9b] text-[#45150b] font-bold shadow'
                : 'bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}

        {periodMode === 'custom' && (
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1 text-xs"
            />
            <span className="text-slate-500">—</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1 text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}
