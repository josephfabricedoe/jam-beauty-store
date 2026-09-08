import React, { useState } from 'react';
import Modal from '../shared/Modal';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useCurrency } from '../../hooks/useCurrency';
import { Scale, TrendingUp, TrendingDown, Wallet, Info } from 'lucide-react';

export default function CashReconciliation({
  expectedCash,
  grossRevenue = 0,
  cashSales = 0,
  deliveryCash = 0,
  expenses = 0,
  dateLabel
}) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const { currentUser, userProfile } = useAuth();
  const { format } = useCurrency();

  const countedNum = parseFloat(counted) || 0;
  const variance = counted !== '' ? countedNum - expectedCash : null;

  const handleSave = async () => {
    if (counted === '') return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'reconciliations'), {
        expectedCash,
        countedCash: countedNum,
        variance,
        dateLabel,
        managerId: currentUser?.uid || 'admin',
        managerName: userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Manager',
        timestamp: serverTimestamp(),
      });
      setResult({ expected: expectedCash, counted: countedNum, variance });
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setResult(null); setCounted(''); }}
        className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 rounded-xl text-sm font-medium transition-colors shadow-sm"
      >
        <Scale className="w-4 h-4 text-amber-400" />
        <span>Drawer Cash Reconciliation</span>
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Daily Drawer Cash Reconciliation"
        size="md"
        footer={
          !result && (
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || counted === ''}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Recording...' : 'Record Count'}
              </button>
            </div>
          )
        }
      >
        {result ? (
          <div className="text-center space-y-4">
            <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-base ${
              result.variance >= 0
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
            }`}>
              {result.variance >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-rose-400" />}
              <span>{result.variance >= 0 ? `CASH OVERAGE: +${format(result.variance)}` : `CASH SHORTAGE: ${format(result.variance)}`}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-700/40 border border-slate-700 rounded-xl p-3">
                <p className="text-slate-400 text-xs">System Expected Cash</p>
                <p className="font-bold text-white text-lg mt-0.5">{format(result.expected)}</p>
              </div>
              <div className="bg-slate-700/40 border border-slate-700 rounded-xl p-3">
                <p className="text-slate-400 text-xs">Physical Counted Cash</p>
                <p className="font-bold text-white text-lg mt-0.5">{format(result.counted)}</p>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Close & Complete
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* System calculation breakdown */}
            <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-1">
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span>System Expected Drawer Cash ({dateLabel})</span>
              </div>
              <p className="text-3xl font-extrabold text-white">{format(expectedCash)}</p>

              <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                <div>
                  <span className="block text-slate-500">Cash Sales:</span>
                  <span className="text-white font-medium">+{format(cashSales)}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Delivery Cash:</span>
                  <span className="text-white font-medium">+{format(deliveryCash)}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Cash Outflows:</span>
                  <span className="text-rose-400 font-medium">-{format(expenses)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Enter Counted Physical Cash in Drawer ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={counted}
                onChange={e => setCounted(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-2xl font-bold text-center focus:outline-none focus:border-amber-400 transition-colors"
                autoFocus
              />
            </div>

            {variance !== null && (
              <div className={`rounded-xl p-3 text-center border ${
                variance >= 0
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                <p className="text-xs font-medium uppercase tracking-wider">
                  {variance >= 0 ? 'Projected Overage' : 'Projected Shortage'}
                </p>
                <p className="text-xl font-bold mt-0.5">
                  {variance >= 0 ? '+' : ''}{format(variance)}
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 bg-slate-700/20 border border-slate-700/40 rounded-xl p-2.5 text-[11px] text-slate-400">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Note: Non-cash payments (MoMo, Card, Bank Transfer) are tracked under Digital Inflows and should not be counted in the physical cash drawer.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
