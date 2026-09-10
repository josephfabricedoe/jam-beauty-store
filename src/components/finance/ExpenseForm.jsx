import React, { useState, useRef } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { compressReceiptImage } from '../../utils/receiptCompressor';
import { 
  PlusCircle, 
  CheckCircle, 
  Camera, 
  Upload, 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  FileText,
  DollarSign
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Supplies & Restock',
  'Logistics & Freight',
  'Store Rent',
  'Generator & Fuel',
  'Transport',
  'Utilities',
  'Marketing',
  'Staff Wages',
  'Maintenance',
  'Other'
];

const PAYMENT_METHODS = [
  { id: 'cash_drawer', label: 'Register Cash Drawer' },
  { id: 'momo', label: 'Mobile Money (MoMo)' },
  { id: 'bank_transfer', label: 'Bank Transfer / FX Wire' },
  { id: 'safe_float', label: 'Store Safe / Float' },
];

export default function ExpenseForm({ onExpenseLogged }) {
  const { currentUser } = useAuth();
  const [form, setForm] = useState({ 
    category: '', 
    amount: '', 
    authorizedBy: '', 
    recipient: '', 
    note: '',
    paymentMethod: 'cash_drawer'
  });
  
  const [receiptImage, setReceiptImage] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const numericAmount = parseFloat(form.amount) || 0;
  const isHighValue = numericAmount >= 50;

  const handleReceiptFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setError('');
    try {
      const compressedDataUrl = await compressReceiptImage(file);
      setReceiptImage(compressedDataUrl);
    } catch (err) {
      console.error('Error compressing receipt:', err);
      setError('Could not process receipt image. Please try another image.');
    } finally {
      setCompressing(false);
    }
  };

  const removeReceipt = () => {
    setReceiptImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.amount) return;

    // Strict $50 security check
    if (isHighValue && !receiptImage) {
      setError('Financial Security Policy: Every expense of $50 USD or more requires an attached receipt or transaction slip.');
      return;
    }

    setLoading(true);
    setSuccess(false);
    setError('');

    try {
      const expenseData = {
        category: form.category,
        amount: numericAmount,
        currency: 'USD',
        paymentMethod: form.paymentMethod,
        authorizedBy: form.authorizedBy.trim() || currentUser?.displayName || 'Manager',
        recipient: form.recipient.trim() || '',
        note: form.note.trim() || '',
        receiptImage: receiptImage || null,
        hasReceipt: !!receiptImage,
        isHighValue,
        status: isHighValue && !receiptImage ? 'pending_receipt' : 'verified',
        loggedBy: currentUser?.uid || 'staff',
        loggedByName: currentUser?.displayName || currentUser?.email || 'Staff',
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'expenses'), expenseData);
      
      setForm({ 
        category: '', 
        amount: '', 
        authorizedBy: '', 
        recipient: '', 
        note: '',
        paymentMethod: 'cash_drawer'
      });
      setReceiptImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      setSuccess(true);
      if (onExpenseLogged) onExpenseLogged(expenseData);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to log expense:', err);
      setError('Failed to log expense: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {/* Financial Security Threshold Alert Banner */}
      {isHighValue && (
        <div className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all ${
          receiptImage 
            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
            : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
        }`}>
          {receiptImage ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
          )}
          <div>
            <span className="font-bold block text-sm">
              {receiptImage 
                ? 'Receipt Attached — High Value Audit Verified' 
                : 'Mandatory Receipt Required (>= $50 USD)'}
            </span>
            <span className="text-[11px] opacity-90 leading-tight block mt-0.5">
              {receiptImage 
                ? 'Proof of payment is securely attached to this expense record.' 
                : 'JAM Beauty financial security policy requires photo proof (bank slip, MoMo screenshot, or signed voucher) for amounts $50 and above before closing the books.'}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs font-medium flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Row 1: Category & Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 mb-1 block font-medium">Expense Category *</label>
          <select 
            value={form.category} 
            onChange={e => set('category', e.target.value)} 
            required 
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-400"
          >
            <option value="">Select category...</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-slate-400 mb-1 block font-medium">Amount in USD ($) *</label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="number" 
              step="0.01" 
              min="0.01" 
              value={form.amount} 
              onChange={e => set('amount', e.target.value)} 
              required 
              placeholder="0.00" 
              className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-rose-400" 
            />
          </div>
        </div>
      </div>

      {/* Row 2: Payment Method & Recipient */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 mb-1 block font-medium">Paid From (Funding Source) *</label>
          <select 
            value={form.paymentMethod} 
            onChange={e => set('paymentMethod', e.target.value)} 
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-400"
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-slate-400 mb-1 block font-medium">Paid To / Recipient</label>
          <input 
            type="text" 
            value={form.recipient} 
            onChange={e => set('recipient', e.target.value)} 
            placeholder="e.g. Dubai Cargo Agent, LEC, Landlord" 
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-400" 
          />
        </div>
      </div>

      {/* Row 3: Authorized By & Description */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-slate-400 mb-1 block font-medium">Authorized By</label>
          <input 
            type="text" 
            value={form.authorizedBy} 
            onChange={e => set('authorizedBy', e.target.value)} 
            placeholder="Manager / Owner name" 
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-400" 
          />
        </div>

        <div>
          <label className="text-slate-400 mb-1 block font-medium">Description / Notes</label>
          <input 
            type="text" 
            value={form.note} 
            onChange={e => set('note', e.target.value)} 
            placeholder="Purpose of disbursement" 
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-400" 
          />
        </div>
      </div>

      {/* Proof of Payment / Transactional Receipt Upload */}
      <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-rose-400" />
            <span>Transactional Receipt / Payment Slip</span>
            {isHighValue && <span className="text-rose-400 font-bold">* (Required for $50+)</span>}
          </label>
          {receiptImage && (
            <button 
              type="button" 
              onClick={removeReceipt}
              className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          )}
        </div>

        {receiptImage ? (
          <div className="flex items-center gap-3 bg-slate-900/80 p-2.5 rounded-lg border border-emerald-500/30">
            <img 
              src={receiptImage} 
              alt="Receipt preview" 
              className="w-14 h-14 object-cover rounded border border-slate-700 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Receipt photo ready
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Compressed & verified. Will be securely linked to this expense and Central Finance.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              capture="environment"
              onChange={handleReceiptFile}
              className="hidden" 
              id="expense-receipt-upload"
            />
            <label 
              htmlFor="expense-receipt-upload"
              className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed cursor-pointer transition-colors ${
                isHighValue 
                  ? 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/50 text-amber-200' 
                  : 'bg-slate-800 hover:bg-slate-700/80 border-slate-600 text-slate-300'
              }`}
            >
              {compressing ? (
                <span>Optimizing receipt image...</span>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-rose-400" />
                  <span className="font-medium">
                    {isHighValue ? '📸 Snap / Upload Required Receipt Slip' : '📸 Snap or Upload Receipt (Optional)'}
                  </span>
                </>
              )}
            </label>
            <p className="text-[10px] text-slate-500 mt-1">
              Supports camera snapshots on smartphones, bank wire slips, MoMo screenshots, or paper vouchers.
            </p>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button 
        type="submit" 
        disabled={loading || compressing} 
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-rose-500/20 active:scale-98"
      >
        {loading ? (
          <span>Saving Expense...</span>
        ) : success ? (
          <>
            <CheckCircle className="w-4 h-4 text-emerald-300" />
            <span>Expense & Receipt Logged!</span>
          </>
        ) : (
          <>
            <PlusCircle className="w-4 h-4" />
            <span>Log Expense & Update Finance</span>
          </>
        )}
      </button>
    </form>
  );
}
