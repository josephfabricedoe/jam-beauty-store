import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../shared/Modal';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { 
  ClipboardCheck, 
  Store, 
  Warehouse, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  History, 
  Clock, 
  Save, 
  RotateCcw,
  Check
} from 'lucide-react';

const REASON_PRESETS = [
  'Showroom tester / display sample used',
  'Damaged / broken packaging disposed',
  'Physical count correction (previous miscount)',
  'Unrecorded showroom-storeroom transfer',
  'Expired / quality check removal',
  'Shrinkage / unrecorded stock shortage',
  'Other (specify in notes)'
];

export default function StockAuditModal({ isOpen, onClose }) {
  const { userProfile, currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active view: 'audit' | 'history'
  const [viewMode, setViewMode] = useState('audit');
  const [auditLocation, setAuditLocation] = useState('showroom'); // 'showroom' | 'storeroom'
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Audit state: map of productId -> { counted: number, reasonPreset: string, reasonCustom: string }
  const [auditEntries, setAuditEntries] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(null);

  // Audit history
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Live products listener
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen]);

  // Live history listener when viewing history
  useEffect(() => {
    if (!isOpen || viewMode !== 'history') return;
    setLoadingHistory(true);
    const unsub = onSnapshot(collection(db, 'inventory_audits'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHistoryLogs(list);
      setLoadingHistory(false);
    });
    return () => unsub();
  }, [isOpen, viewMode]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category || 'General').filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchSku = (p.sku || '').toLowerCase().includes(q);
        const matchBarcode = (p.barcode || '').toLowerCase().includes(q);
        return matchName || matchSku || matchBarcode;
      }
      return true;
    });
  }, [products, categoryFilter, searchTerm]);

  // Handle count entry
  const handleCountChange = (productId, val) => {
    setAuditEntries(prev => {
      const existing = prev[productId] || {};
      if (val === '') {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return {
        ...prev,
        [productId]: {
          ...existing,
          counted: parseInt(val, 10),
        }
      };
    });
  };

  const handleReasonPresetChange = (productId, preset) => {
    setAuditEntries(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        reasonPreset: preset,
      }
    }));
  };

  const handleReasonCustomChange = (productId, custom) => {
    setAuditEntries(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        reasonCustom: custom,
      }
    }));
  };

  // Compute audit summary stats
  const auditStats = useMemo(() => {
    const countedIds = Object.keys(auditEntries).filter(id => auditEntries[id]?.counted !== undefined && !isNaN(auditEntries[id].counted));
    let balancedCount = 0;
    let shortageCount = 0;
    let overageCount = 0;
    let netVarianceUnits = 0;
    const adjustedList = [];

    countedIds.forEach(id => {
      const prod = products.find(p => p.id === id);
      if (!prod) return;
      const expected = auditLocation === 'showroom' ? (prod.showroomQty || 0) : (prod.storeroomQty || 0);
      const counted = auditEntries[id].counted;
      const variance = counted - expected;
      netVarianceUnits += variance;

      if (variance === 0) {
        balancedCount++;
      } else if (variance < 0) {
        shortageCount++;
      } else {
        overageCount++;
      }

      if (variance !== 0) {
        const explanation = [
          auditEntries[id].reasonPreset && auditEntries[id].reasonPreset !== 'Other (specify in notes)' ? auditEntries[id].reasonPreset : '',
          (auditEntries[id].reasonCustom || '').trim()
        ].filter(Boolean).join(' - ') || 'Count adjustment';

        adjustedList.push({
          productId: prod.id,
          productName: prod.name,
          category: prod.category || 'General',
          expected,
          counted,
          variance,
          reason: explanation,
        });
      }
    });

    return {
      totalAudited: countedIds.length,
      balancedCount,
      shortageCount,
      overageCount,
      netVarianceUnits,
      adjustedList,
    };
  }, [auditEntries, products, auditLocation]);

  // Submit physical audit
  const handleSubmitAudit = async () => {
    if (auditStats.totalAudited === 0) {
      alert('Please enter physical counts for at least one product.');
      return;
    }

    // Ensure all items with variance have an explanation
    const missingReasons = auditStats.adjustedList.filter(it => !it.reason || it.reason === 'Count adjustment');
    if (missingReasons.length > 0) {
      const first = missingReasons[0];
      alert(`Please select or enter a reason for the discrepancy on "${first.productName}" (Variance: ${first.variance > 0 ? `+${first.variance}` : first.variance}).`);
      return;
    }

    if (!window.confirm(`Submit physical audit for ${auditStats.totalAudited} items in the ${auditLocation.toUpperCase()}?\n\n` +
      `• Balanced items: ${auditStats.balancedCount}\n` +
      `• Discrepancies to adjust: ${auditStats.adjustedList.length}\n` +
      `• Net unit change: ${auditStats.netVarianceUnits > 0 ? `+${auditStats.netVarianceUnits}` : auditStats.netVarianceUnits}`)) {
      return;
    }

    setSubmitting(true);
    try {
      // 1. Update product quantities in Firestore
      for (const it of auditStats.adjustedList) {
        const fieldName = auditLocation === 'showroom' ? 'showroomQty' : 'storeroomQty';
        await updateDoc(doc(db, 'products', it.productId), {
          [fieldName]: it.counted,
          updatedAt: serverTimestamp(),
        });
      }

      // 2. Log comprehensive audit history entry
      const auditorName = userProfile?.displayName || currentUser?.email || 'Store Auditor';
      const auditorRole = userProfile?.role || 'manager';
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      await addDoc(collection(db, 'inventory_audits'), {
        location: auditLocation,
        date: todayStr,
        time: timeStr,
        auditorName,
        auditorRole,
        totalAudited: auditStats.totalAudited,
        balancedCount: auditStats.balancedCount,
        discrepancyCount: auditStats.adjustedList.length,
        netVarianceUnits: auditStats.netVarianceUnits,
        adjustments: auditStats.adjustedList,
        createdAt: serverTimestamp(),
      });

      setSuccessNotice(`Audit saved! ${auditStats.adjustedList.length} items reconciled in ${auditLocation}.`);
      setAuditEntries({});
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err) {
      console.error('Error submitting audit:', err);
      alert('Failed to save audit: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Physical Stock Audit & Cycle Count"
      size="xl"
      footer={
        viewMode === 'audit' ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="text-xs text-slate-300">
              Audited: <strong className="text-white">{auditStats.totalAudited}</strong> products ·{' '}
              <span className="text-emerald-400 font-semibold">{auditStats.balancedCount} balanced</span> ·{' '}
              <span className="text-rose-400 font-semibold">{auditStats.shortageCount + auditStats.overageCount} with variance</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuditEntries({})}
                disabled={auditStats.totalAudited === 0 || submitting}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
              >
                Reset Counts
              </button>
              <button
                type="button"
                onClick={handleSubmitAudit}
                disabled={auditStats.totalAudited === 0 || submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-[#efaa9b]/20 disabled:opacity-40"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'Updating Database...' : 'Apply & Save Audit'}</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setViewMode('audit')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold"
          >
            Back to Audit
          </button>
        )
      }
    >
      <div className="space-y-4">
        {/* View Switcher & Location Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'audit'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Perform Audit</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'history'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Audit History</span>
            </button>
          </div>

          {viewMode === 'audit' && (
            <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 px-2 font-semibold uppercase">Location:</span>
              <button
                type="button"
                onClick={() => {
                  setAuditLocation('showroom');
                  setAuditEntries({});
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  auditLocation === 'showroom'
                    ? 'bg-[#efaa9b] text-[#45150b]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Showroom Shelves</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuditLocation('storeroom');
                  setAuditEntries({});
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  auditLocation === 'storeroom'
                    ? 'bg-[#efaa9b] text-[#45150b]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Warehouse className="w-3.5 h-3.5" />
                <span>Storeroom Warehouse</span>
              </button>
            </div>
          )}
        </div>

        {successNotice && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* AUDIT MODE */}
        {viewMode === 'audit' && (
          <>
            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search item name, SKU, or barcode..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#efaa9b]"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                ))}
              </select>
            </div>

            {/* Audit Table */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60 max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/90 text-slate-400 font-semibold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">Product</th>
                    <th className="px-2.5 py-2.5 text-center">Expected ({auditLocation})</th>
                    <th className="px-2.5 py-2.5 text-center">Physical Count</th>
                    <th className="px-2.5 py-2.5 text-center">Variance</th>
                    <th className="px-3 py-2.5">Discrepancy Reason (If Variance)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        {loading ? 'Loading products...' : 'No products found matching filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(prod => {
                      const expected = auditLocation === 'showroom' ? (prod.showroomQty || 0) : (prod.storeroomQty || 0);
                      const entry = auditEntries[prod.id];
                      const hasCount = entry?.counted !== undefined && !isNaN(entry.counted);
                      const variance = hasCount ? entry.counted - expected : null;

                      return (
                        <tr key={prod.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-3.5 py-2.5">
                            <p className="font-semibold text-white truncate max-w-[200px]">{prod.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{prod.category || 'General'}</span>
                              {prod.sku && <span>· SKU: {prod.sku}</span>}
                            </div>
                          </td>

                          {/* Expected Count */}
                          <td className="px-2.5 py-2.5 text-center">
                            <span className="font-bold text-white text-sm bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700">
                              {expected}
                            </span>
                          </td>

                          {/* Physical Count Input */}
                          <td className="px-2.5 py-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={entry?.counted ?? ''}
                              onChange={e => handleCountChange(prod.id, e.target.value)}
                              placeholder="Count"
                              className="w-16 text-center font-bold text-sm bg-slate-800 border border-slate-700 focus:border-[#efaa9b] rounded-lg px-2 py-1 text-white focus:outline-none"
                            />
                          </td>

                          {/* Variance Badge */}
                          <td className="px-2.5 py-2.5 text-center">
                            {variance === null ? (
                              <span className="text-[10px] text-slate-500">—</span>
                            ) : variance === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                <Check className="w-3 h-3" /> Balanced
                              </span>
                            ) : variance < 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-500/40">
                                <TrendingDown className="w-3 h-3" /> {variance}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-500/40">
                                <TrendingUp className="w-3 h-3" /> +{variance}
                              </span>
                            )}
                          </td>

                          {/* Discrepancy Reason Input */}
                          <td className="px-3 py-2.5">
                            {variance !== null && variance !== 0 ? (
                              <div className="space-y-1">
                                <select
                                  value={entry?.reasonPreset || ''}
                                  onChange={e => handleReasonPresetChange(prod.id, e.target.value)}
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                                >
                                  <option value="">Select reason...</option>
                                  {REASON_PRESETS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={entry?.reasonCustom || ''}
                                  onChange={e => handleReasonCustomChange(prod.id, e.target.value)}
                                  placeholder="Specific details..."
                                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg px-2 py-1 text-[10px] text-slate-200 focus:outline-none"
                                />
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">No variance</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* HISTORY MODE */}
        {viewMode === 'history' && (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {loadingHistory ? (
              <div className="py-12 text-center text-slate-500 text-xs">Loading audit records...</div>
            ) : historyLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No past physical audit records found.</p>
              </div>
            ) : (
              historyLogs.map(log => (
                <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{log.date} · {log.time}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-[#efaa9b] border border-slate-700">
                        {log.location === 'showroom' ? 'Showroom Shelves' : 'Storeroom Warehouse'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Auditor: <strong className="text-white">{log.auditorName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-300">
                    <span>Items Counted: <strong>{log.totalAudited}</strong></span>
                    <span className="text-emerald-400 font-semibold">Balanced: {log.balancedCount}</span>
                    <span className="text-rose-400 font-semibold">Discrepancies: {log.discrepancyCount}</span>
                    <span>Net Adjustment: <strong>{log.netVarianceUnits > 0 ? `+${log.netVarianceUnits}` : log.netVarianceUnits} units</strong></span>
                  </div>

                  {log.adjustments && log.adjustments.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reconciled Items:</p>
                      <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                        {log.adjustments.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-slate-300">
                            <span className="truncate">{it.productName} ({it.category})</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="font-mono text-slate-400">{it.expected} → {it.counted}</span>
                              <span className={`font-bold font-mono ${it.variance > 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                ({it.variance > 0 ? `+${it.variance}` : it.variance})
                              </span>
                              <span className="text-[10px] text-amber-300/90 italic max-w-[150px] truncate">{it.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
