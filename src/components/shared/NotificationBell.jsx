import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Bell, AlertTriangle, ShoppingCart, X } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [lowStock, setLowStock] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const ref = useRef(null);
  const { format } = useCurrency();

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'products'), where('showroomQty', '<', 5)),
      snap => setLowStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return onSnapshot(
      query(
        collection(db, 'sales'),
        where('timestamp', '>=', Timestamp.fromDate(start)),
        orderBy('timestamp', 'desc'),
        limit(20)
      ),
      snap => setTodaySales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const todayTotal = todaySales.reduce((s, x) => s + (x.total || 0), 0);
  const alertCount = lowStock.length;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
        <Bell className="w-5 h-5" />
        {alertCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 className="font-semibold text-white text-sm">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-4 h-4 text-green-400" />
                <span className="text-xs font-medium text-slate-300">Today's Sales</span>
              </div>
              <p className="text-xl font-bold text-white">{format(todayTotal)}</p>
              <p className="text-xs text-slate-500">{todaySales.length} transaction{todaySales.length !== 1 ? 's' : ''} today</p>
            </div>
            {lowStock.length > 0 ? (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-red-400">{lowStock.length} Low Stock Alert{lowStock.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-1.5">
                  {lowStock.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-red-900/20 border border-red-800/30 rounded-lg px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.barcode}</p>
                      </div>
                      <span className="text-xs font-bold text-red-400 ml-2 flex-shrink-0">{p.showroomQty} left</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-slate-500">All stock levels healthy ✓</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
