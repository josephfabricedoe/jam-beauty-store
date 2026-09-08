import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { PlusCircle, CheckCircle } from 'lucide-react';

const EXPENSE_CATEGORIES = ['Supplies', 'Transport', 'Utilities', 'Marketing', 'Staff', 'Maintenance', 'Other'];

export default function ExpenseForm() {
  const { currentUser } = useAuth();
  const [form, setForm] = useState({ category: '', amount: '', authorizedBy: '', recipient: '', note: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.amount) return;
    setLoading(true); setSuccess(false);
    try {
      await addDoc(collection(db, 'expenses'), {
        ...form,
        amount: parseFloat(form.amount),
        currency: 'USD',
        loggedBy: currentUser.uid,
        timestamp: serverTimestamp(),
      });
      setForm({ category: '', amount: '', authorizedBy: '', recipient: '', note: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) { alert('Failed to log expense: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Category *</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} required className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400">
            <option value="">Select...</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Amount (USD) *</label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0.00" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Authorized By</label>
          <input type="text" value={form.authorizedBy} onChange={e => set('authorizedBy', e.target.value)} placeholder="Manager name" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Recipient</label>
          <input type="text" value={form.recipient} onChange={e => set('recipient', e.target.value)} placeholder="Who received it" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400" />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Note</label>
        <input type="text" value={form.note} onChange={e => set('note', e.target.value)} placeholder="Description" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400" />
      </div>
      <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
        {success ? <><CheckCircle className="w-4 h-4" /> Logged!</> : <><PlusCircle className="w-4 h-4" /> {loading ? 'Saving...' : 'Log Expense'}</>}
      </button>
    </form>
  );
}
