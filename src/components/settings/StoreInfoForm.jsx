import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Save, CheckCircle } from 'lucide-react';

export default function StoreInfoForm({ settings }) {
  const [storeName, setStoreName] = useState('JAM Beauty Store');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [tagline, setTagline] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for shopping with us!');
  const [taxRate, setTaxRate] = useState(0);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('Cash');
  const [exchangeRate, setExchangeRate] = useState(197);
  const [logoUrl, setLogoUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync with Firestore settings once loaded
  useEffect(() => {
    if (settings) {
      if (settings.storeName !== undefined) setStoreName(settings.storeName);
      if (settings.address !== undefined) setAddress(settings.address);
      if (settings.phone !== undefined) setPhone(settings.phone);
      if (settings.tagline !== undefined) setTagline(settings.tagline);
      if (settings.receiptFooter !== undefined) setReceiptFooter(settings.receiptFooter);
      if (settings.taxRate !== undefined) setTaxRate(settings.taxRate);
      if (settings.defaultPaymentMethod !== undefined) setDefaultPaymentMethod(settings.defaultPaymentMethod);
      if (settings.exchangeRate !== undefined) setExchangeRate(settings.exchangeRate);
      if (settings.logoUrl !== undefined) setLogoUrl(settings.logoUrl);
    }
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'storeSettings', 'config'), {
        storeName,
        address,
        phone,
        tagline,
        receiptFooter,
        taxRate: parseFloat(taxRate) || 0,
        defaultPaymentMethod,
        exchangeRate: parseFloat(exchangeRate) || 197,
        logoUrl,
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-3">Store Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Store Name</label>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="JAM Beauty Store"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+231 777 000 000"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Monrovia, Liberia"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="Your beauty, our passion"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 transition-colors"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-3">Receipt Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Logo URL (image link)</label>
            <input
              type="text"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Receipt Footer Message</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={e => setReceiptFooter(e.target.value)}
              placeholder="Thank you for shopping!"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Default Payment Method</label>
            <select
              value={defaultPaymentMethod}
              onChange={e => setDefaultPaymentMethod(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
            >
              {['Cash', 'MoMo', 'Card', 'Transfer'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tax Rate (%)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={taxRate}
              onChange={e => setTaxRate(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 transition-colors"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-3">Currency</h3>
        <div className="flex items-center gap-2 max-w-xs">
          <span className="text-slate-400 text-sm whitespace-nowrap">1 USD =</span>
          <input
            type="number"
            min="1"
            value={exchangeRate}
            onChange={e => setExchangeRate(e.target.value)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
          />
          <span className="text-slate-400 text-sm">LRD</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-slate-700">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-rose-500/20"
        >
          {saved ? <><CheckCircle className="w-4 h-4 text-white" /> Settings Saved!</> : <><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}</>}
        </button>
        {saved && <span className="text-green-400 text-sm">Updated successfully.</span>}
      </div>
    </form>
  );
}
