import React, { useState, useRef } from 'react';
import Modal from '../shared/Modal';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../contexts/AppContext';
import { useCurrency } from '../../hooks/useCurrency';
import { 
  Scale, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Info, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  Unlock,
  MessageCircle,
  Copy,
  Check
} from 'lucide-react';

const COMMON_REASONS = [
  'Currency exchange rate fluctuation (USD / LRD conversion)',
  'Minor customer change shortage / coin unavailable',
  'Customer tip or extra cash left in drawer',
  'Unrecorded small store supply / petty cash purchase',
  'Unrecorded supplier restock cash payout',
  'Cashier change calculation error',
  'Counterfeit bill rejected / removed from drawer',
  'Other (specify below)'
];

export default function CashReconciliation({
  expectedCash,
  grossRevenue = 0,
  cashSales = 0,
  deliveryCash = 0,
  expenses = 0,
  dateLabel
}) {
  const [open, setOpen] = useState(false);
  const [countedUSD, setCountedUSD] = useState('');
  const [countedLRD, setCountedLRD] = useState('');
  const [cashierReasonPreset, setCashierReasonPreset] = useState('');
  const [cashierReasonCustom, setCashierReasonCustom] = useState('');
  const [managerApproved, setManagerApproved] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const reasonInputRef = useRef(null);
  const managerNameInputRef = useRef(null);

  const { currentUser, userProfile } = useAuth();
  const { exchangeRate = 195 } = useApp();
  const { format } = useCurrency();

  const generateZReportText = () => {
    const dateStr = dateLabel || new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const cashierName = userProfile?.displayName || currentUser?.email || 'Store Cashier';
    const roleName = userProfile?.role ? userProfile.role.toUpperCase() : 'CASHIER';

    const statusStr = result?.isBalanced
      ? 'BALANCED ($0.00 variance)'
      : (result?.variance || 0) >= 0
      ? `OVERAGE (+${format(result?.variance || 0)})`
      : `SHORTAGE (-${format(Math.abs(result?.variance || 0))})`;

    return `✨ *JAM BEAUTY STORE — DAILY EXECUTIVE Z-REPORT* ✨
📅 *Date:* ${dateStr}
👤 *Duty Staff:* ${cashierName} (${roleName})

💵 *FINANCIAL OVERVIEW:*
• Gross Store Sales: ${format(grossRevenue)}
• Cash Register Sales: ${format(cashSales)}
• Delivery Cash (COD): ${format(deliveryCash)}
• Operating Cash Expenses: ${format(expenses)}

🏦 *CASH DRAWER RECONCILIATION:*
• System Expected Cash: ${format(expectedCash)}
• Physical Cash Counted: ${format(result?.counted || totalCountedUSD)}
• Drawer Status: ${statusStr}
${result?.explanation ? `• Recorded Reason: ${result.explanation}\n` : ''}${result?.managerName ? `• Authorized By: ${result.managerName}\n` : ''}
✅ Shift successfully balanced & closed in store database.
📍 JAM Beauty Store · Official Operations`;
  };

  const handleCopyZReport = async () => {
    try {
      await navigator.clipboard.writeText(generateZReportText());
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Cash counting calculation
  const usdNum = parseFloat(countedUSD) || 0;
  const lrdNum = parseFloat(countedLRD) || 0;
  const lrdInUSD = exchangeRate > 0 ? lrdNum / exchangeRate : 0;
  const hasEnteredCount = countedUSD !== '' || countedLRD !== '';
  const totalCountedUSD = usdNum + lrdInUSD;

  const variance = hasEnteredCount ? totalCountedUSD - expectedCash : null;
  const absVariance = variance !== null ? Math.abs(variance) : 0;

  // Discrepancy tiers based on store policy:
  // 1. Balanced: variance <= $0.05
  // 2. Minor Discrepancy (<= $5.00): Cashier must explain, can close WITHOUT manager approval
  // 3. Major Discrepancy (> $5.00): Cashier must explain AND Manager Approval REQUIRED
  const isBalanced = variance !== null && absVariance <= 0.05;
  const isMinorDiscrepancy = variance !== null && absVariance > 0.05 && absVariance <= 5.00;
  const isMajorDiscrepancy = variance !== null && absVariance > 5.00;

  const finalExplanation = [
    cashierReasonPreset && cashierReasonPreset !== 'Other (specify below)' ? cashierReasonPreset : '',
    cashierReasonCustom.trim()
  ].filter(Boolean).join(' - ');

  const isFormValid = () => {
    if (!hasEnteredCount) {
      return { valid: false, message: 'Please enter physical cash counted in drawer (USD or LRD).' };
    }
    if (isBalanced) {
      return { valid: true };
    }
    if (isMinorDiscrepancy) {
      if (!finalExplanation.trim()) {
        return { 
          valid: false, 
          message: 'Please provide a brief explanation for the minor variance (under $5.00).',
          focusTarget: 'reason'
        };
      }
      return { valid: true };
    }
    if (isMajorDiscrepancy) {
      if (!finalExplanation.trim()) {
        return { 
          valid: false, 
          message: 'Discrepancy exceeds $5.00: Please enter a mandatory cashier explanation.',
          focusTarget: 'reason'
        };
      }
      if (!managerApproved) {
        return { 
          valid: false, 
          message: '🔒 Discrepancy exceeds $5.00: Manager authorization is required to finalize reconciliation.',
          focusTarget: 'manager'
        };
      }
      return { valid: true };
    }
    return { valid: true };
  };

  const handleSave = async () => {
    setErrorMessage('');
    const check = isFormValid();
    if (!check.valid) {
      setErrorMessage(check.message);
      if (check.focusTarget === 'reason' && reasonInputRef.current) {
        reasonInputRef.current.focus();
      } else if (check.focusTarget === 'manager' && managerNameInputRef.current) {
        managerNameInputRef.current.focus();
      }
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'reconciliations'), {
        expectedCash,
        grossRevenue,
        cashSales,
        deliveryCash,
        expenses,
        countedCashUSD: usdNum,
        countedCashLRD: lrdNum,
        totalCountedUSD,
        exchangeRate,
        variance,
        absVariance,
        varianceType: isBalanced ? 'balanced' : variance > 0 ? 'over' : 'short',
        isMinorDiscrepancy,
        isMajorDiscrepancy,
        cashierExplanation: finalExplanation,
        managerApproved: isMajorDiscrepancy ? managerApproved : false,
        managerName: isMajorDiscrepancy ? (managerName.trim() || 'Manager Authorized') : '',
        cashierId: currentUser?.uid || 'staff',
        cashierName: userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Cashier',
        dateLabel,
        timestamp: serverTimestamp(),
      });

      setResult({ 
        expected: expectedCash, 
        counted: totalCountedUSD, 
        variance,
        isBalanced,
        isMinorDiscrepancy,
        isMajorDiscrepancy,
        explanation: finalExplanation,
        managerName: managerName.trim()
      });
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleOpenModal = () => {
    setOpen(true);
    setResult(null);
    setCountedUSD('');
    setCountedLRD('');
    setCashierReasonPreset('');
    setCashierReasonCustom('');
    setManagerApproved(false);
    setManagerName('');
    setErrorMessage('');
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 rounded-xl text-sm font-medium transition-colors shadow-sm"
      >
        <Scale className="w-4 h-4 text-amber-400" />
        <span>Drawer Cash Reconciliation</span>
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Daily Drawer Cash Reconciliation"
        size="lg"
        footer={
          !result && (
            <div className="flex items-center justify-between gap-3 w-full">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !hasEnteredCount || (isMajorDiscrepancy && !managerApproved)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                    isBalanced
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                      : isMinorDiscrepancy
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                      : isMajorDiscrepancy
                      ? managerApproved
                        ? 'bg-rose-500 hover:bg-rose-400 text-white font-black'
                        : 'bg-slate-700 text-slate-400 border border-slate-600 cursor-not-allowed opacity-60'
                      : 'bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b]'
                  }`}
                >
                  {saving ? (
                    <span>Recording...</span>
                  ) : isBalanced ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Balanced — Save Reconciliation</span>
                    </>
                  ) : isMinorDiscrepancy ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Minor Variance (Explained)</span>
                    </>
                  ) : isMajorDiscrepancy ? (
                    managerApproved ? (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Save Authorized Discrepancy</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Shift Locked (Manager Approval Req.)</span>
                      </>
                    )
                  ) : (
                    <span>Record Count (Enter)</span>
                  )}
                </button>
              </div>
            </div>
          )
        }
      >
        {result ? (
          <div className="text-center space-y-4 py-2">
            <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-base ${
              result.isBalanced
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                : result.variance >= 0
                ? 'bg-blue-950/60 text-blue-300 border border-blue-500/40'
                : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
            }`}>
              {result.isBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : result.variance >= 0 ? (
                <TrendingUp className="w-5 h-5 text-blue-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-400" />
              )}
              <span>
                {result.isBalanced
                  ? 'DRAWER CASH BALANCED ($0.00)'
                  : result.variance >= 0
                  ? `CASH OVERAGE: +${format(result.variance)}`
                  : `CASH SHORTAGE: -${format(Math.abs(result.variance))}`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm max-w-md mx-auto">
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">
                <p className="text-slate-400 text-xs">System Expected Cash</p>
                <p className="font-bold text-white text-lg mt-0.5">{format(result.expected)}</p>
              </div>
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">
                <p className="text-slate-400 text-xs">Physical Counted Cash</p>
                <p className="font-bold text-white text-lg mt-0.5">{format(result.counted)}</p>
              </div>
            </div>

            {result.explanation && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-left max-w-md mx-auto">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recorded Discrepancy Reason</p>
                <p className="text-xs text-slate-200 mt-1 font-medium">{result.explanation}</p>
                {result.managerName && (
                  <p className="text-[11px] text-amber-400 mt-1">Authorized by: <strong>{result.managerName}</strong></p>
                )}
              </div>
            )}

            {/* Daily Executive WhatsApp Z-Report Card */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-left space-y-3 max-w-md mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">Executive WhatsApp Z-Report</h4>
                    <p className="text-[10px] text-emerald-300/80">Daily Briefing for Malydia & Joseph</p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Ready to Send
                </span>
              </div>

              <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-700/80 text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed select-all">
                {generateZReportText()}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generateZReportText())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send via WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyZReport}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-6 py-2.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-sm font-bold transition-colors shadow-md shadow-rose-500/20"
            >
              Close & Complete
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* System calculation breakdown */}
            <div className="bg-slate-900/70 border border-slate-700/80 rounded-2xl p-4 text-center">
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
                  <span className="block text-slate-500">Delivery COD:</span>
                  <span className="text-white font-medium">+{format(deliveryCash)}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Drawer Payouts:</span>
                  <span className="text-rose-400 font-medium">-{format(expenses)}</span>
                </div>
              </div>
            </div>

            {/* Dual USD & LRD Physical Counting Inputs */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Physical Cash Counted in Drawer
                </label>
                <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  Rate: 1 USD = {exchangeRate} LRD
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    USD Cash Bills ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={countedUSD}
                    onChange={e => setCountedUSD(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="0.00"
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-lg font-bold text-center focus:outline-none focus:border-amber-400 transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    LRD Cash Notes (L$)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={countedLRD}
                    onChange={e => setCountedLRD(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="0"
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-lg font-bold text-center focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>
              </div>

              {/* Total Counted & Live Variance Feedback */}
              {hasEnteredCount && (
                <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2 items-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Counted (USD Eqv):</span>
                    <span className="font-mono font-bold text-white text-base">
                      ${totalCountedUSD.toFixed(2)}
                    </span>
                    {lrdNum > 0 && (
                      <span className="text-[10px] text-slate-400 block">
                        (includes L${lrdNum.toLocaleString()} @ {exchangeRate})
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Drawer Variance:</span>
                    <span
                      className={`text-base font-black font-mono inline-flex items-center gap-1 ${
                        isBalanced
                          ? 'text-emerald-400'
                          : variance > 0
                          ? 'text-blue-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {isBalanced ? (
                        'BALANCED ($0.00)'
                      ) : variance > 0 ? (
                        `+$${variance.toFixed(2)} (OVER)`
                      ) : (
                        `-$${Math.abs(variance).toFixed(2)} (SHORT)`
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ERROR / VALIDATION BANNER */}
            {errorMessage && (
              <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* TIER 2: MINOR DISCREPANCY (<= $5.00) */}
            {isMinorDiscrepancy && (
              <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    Minor Variance Detected ({variance > 0 ? `+$${variance.toFixed(2)} OVER` : `-$${Math.abs(variance).toFixed(2)} SHORT`})
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Variances under <strong>$5.00 USD</strong> (or equivalent in LRD) are common due to exchange rate changes or small change rounding. The shift can be closed <strong>without manager approval</strong> once the cashier provides an explanation.
                </p>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    Cashier Explanation (Mandatory)
                  </label>
                  <select
                    value={cashierReasonPreset}
                    onChange={e => setCashierReasonPreset(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">Select reason / common cause...</option>
                    {COMMON_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <input
                    ref={reasonInputRef}
                    type="text"
                    value={cashierReasonCustom}
                    onChange={e => setCashierReasonCustom(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Additional details (e.g. 50 LRD bill shortage on change)"
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {/* TIER 3: MAJOR DISCREPANCY (> $5.00) */}
            {isMajorDiscrepancy && (
              <div className="bg-rose-950/50 border-2 border-rose-500/70 rounded-2xl p-4 text-xs space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                    <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 animate-pulse" />
                    <span>
                      Significant Cash Discrepancy ({variance > 0 ? `+$${variance.toFixed(2)} OVER` : `-$${Math.abs(variance).toFixed(2)} SHORT`})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold uppercase border border-rose-500/40">
                    Manager Sign-Off Required
                  </span>
                </div>

                <div className="bg-slate-900/90 rounded-xl p-3 border border-rose-500/30 text-[11px] text-slate-300 space-y-1.5">
                  <p className="font-bold text-amber-300">🔎 Recount Checklist before closing:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[10px]">
                    <li>Did you count both USD bills and LRD notes accurately?</li>
                    <li>Were there any unrecorded supplier payouts or store supply expenses?</li>
                    <li>Were there any delivery COD cash envelopes not yet turned in?</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                    1. Cashier Explanation (Mandatory)
                  </label>
                  <select
                    value={cashierReasonPreset}
                    onChange={e => setCashierReasonPreset(e.target.value)}
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">Select reason / investigation outcome...</option>
                    {COMMON_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <input
                    ref={reasonInputRef}
                    type="text"
                    value={cashierReasonCustom}
                    onChange={e => setCashierReasonCustom(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Specific investigation notes..."
                    className="w-full bg-slate-900 border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                  />
                </div>

                {/* Manager Sign-Off Gatekeeper */}
                <div className="pt-2 border-t border-rose-500/30 space-y-2">
                  <label className="block text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                    2. Manager Authorization (Mandatory for &gt; $5.00)
                  </label>

                  <div className="bg-slate-900/90 p-3 rounded-xl border border-rose-500/40 space-y-2.5">
                    <label className="flex items-center gap-2 text-xs text-white font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={managerApproved}
                        onChange={e => setManagerApproved(e.target.checked)}
                        className="w-4 h-4 rounded border-rose-500 text-rose-600 focus:ring-rose-500"
                      />
                      <span>Manager Override & Authorization to finalize with variance</span>
                    </label>

                    {managerApproved && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Authorizing Manager Name:</label>
                        <input
                          ref={managerNameInputRef}
                          type="text"
                          value={managerName}
                          onChange={e => setManagerName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="e.g., Joseph Doe / Store Manager"
                          className="w-full bg-slate-800 border border-rose-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 bg-slate-800/40 border border-slate-700/50 rounded-xl p-2.5 text-[11px] text-slate-400">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded border border-slate-600 text-slate-200 text-[10px] font-mono">Enter</kbd> anytime to validate and submit. Reconciliations are stored securely in the financial audit log.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
