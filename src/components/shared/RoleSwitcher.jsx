import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { Monitor, Smartphone } from 'lucide-react';

export default function RoleSwitcher() {
  const { viewMode, setViewMode } = useApp();
  return (
    <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
      <button
        onClick={() => setViewMode('staff')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
          viewMode === 'staff' ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Staff View</span>
      </button>
      <button
        onClick={() => setViewMode('admin')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
          viewMode === 'admin' ? 'bg-rose-500 text-white shadow' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Monitor className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Admin View</span>
      </button>
    </div>
  );
}
