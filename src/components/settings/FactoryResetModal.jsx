import React, { useState } from 'react';
import Modal from '../shared/Modal';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, writeBatch, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { ShieldAlert, Trash2, AlertTriangle, CheckCircle, Lock, Mail, RefreshCw } from 'lucide-react';

export default function FactoryResetModal({ isOpen, onClose }) {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');

  // Items to reset
  const [wipeSales, setWipeSales] = useState(true);
  const [wipeExpenses, setWipeExpenses] = useState(true);
  const [wipeHandovers, setWipeHandovers] = useState(true);
  const [wipeAttendance, setWipeAttendance] = useState(true);
  const [wipeDeliveries, setWipeDeliveries] = useState(true);
  const [wipeCustomers, setWipeCustomers] = useState(true);
  const [wipeSuppliers, setWipeSuppliers] = useState(true);
  const [wipeProducts, setWipeProducts] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const deleteCollectionDocs = async (collectionName) => {
    setProgressMsg(`Clearing ${collectionName}...`);
    const snap = await getDocs(collection(db, collectionName));
    const docs = [...snap.docs];

    while (docs.length > 0) {
      const batch = writeBatch(db);
      const chunk = docs.splice(0, 400);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  };

  const handleFactoryReset = async (e) => {
    e.preventDefault();
    setError('');

    if (confirmPhrase.trim().toUpperCase() !== 'FACTORY RESET') {
      setError('Please type the exact phrase "FACTORY RESET" to confirm.');
      return;
    }

    setLoading(true);
    setProgressMsg('Verifying admin authentication credentials...');

    try {
      // 1. Verify Admin Credentials with Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      const user = cred.user;

      // 2. Check if user is an admin in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const role = userDoc.exists() ? userDoc.data().role : null;

      if (role !== 'admin') {
        throw new Error('Access denied. Only registered store administrators can perform a factory reset.');
      }

      // 3. Perform wipe on selected collections
      if (wipeSales) {
        await deleteCollectionDocs('sales');
        await deleteCollectionDocs('onlineOrders');
      }

      if (wipeExpenses) {
        await deleteCollectionDocs('expenses');
      }

      if (wipeHandovers) {
        await deleteCollectionDocs('shiftHandovers');
      }

      if (wipeAttendance) {
        await deleteCollectionDocs('attendance');
      }

      if (wipeDeliveries) {
        await deleteCollectionDocs('deliveries');
      }

      if (wipeCustomers) {
        await deleteCollectionDocs('customers');
        await deleteCollectionDocs('customerTransactions');
      }

      if (wipeSuppliers) {
        await deleteCollectionDocs('suppliers');
        await deleteCollectionDocs('restockOrders');
      }

      if (wipeProducts) {
        await deleteCollectionDocs('products');
      }

      setProgressMsg('Finishing reset...');
      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Factory reset failed:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect admin password.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No administrator account found with this email.');
      } else {
        setError(err.message || 'Factory reset failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title="System Factory Reset"
      size="md"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            form="factory-reset-form"
            type="submit"
            disabled={loading || confirmPhrase.trim().toUpperCase() !== 'FACTORY RESET'}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-red-600 hover:bg-red-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/30"
          >
            <Trash2 className="w-4 h-4" />
            <span>{loading ? 'Wiping Data...' : 'Confirm Factory Reset'}</span>
          </button>
        </div>
      }
    >
      {success ? (
        <div className="py-8 flex flex-col items-center text-center space-y-3 animate-fade-in">
          <CheckCircle className="w-16 h-16 text-emerald-400 animate-bounce" />
          <h3 className="text-lg font-bold text-white">Factory Reset Complete!</h3>
          <p className="text-xs text-slate-300 max-w-xs">
            The selected store data has been wiped clean. Reloading app to fresh state...
          </p>
        </div>
      ) : (
        <form id="factory-reset-form" onSubmit={handleFactoryReset} className="space-y-4">
          {/* Warning Banner */}
          <div className="p-3.5 bg-red-950/50 border border-red-700/60 rounded-xl text-xs space-y-1.5 text-red-200">
            <div className="flex items-center gap-2 font-bold text-red-300">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>Danger Zone: Permanent Data Wipe</span>
            </div>
            <p className="text-[11px] leading-relaxed text-red-200/90">
              This action will reset your operational data to factory state. It cannot be undone.
              To execute this, you must provide your store <strong>Administrator Email and Password</strong>.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 text-xs text-red-300 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Collections Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Select Data To Reset:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wipeSales}
                  onChange={e => setWipeSales(e.target.checked)}
                  className="rounded border-slate-600 text-red-500 focus:ring-red-500"
                />
                <span>Sales & Online Orders</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wipeExpenses}
                  onChange={e => setWipeExpenses(e.target.checked)}
                  className="rounded border-slate-600 text-red-500 focus:ring-red-500"
                />
                <span>Expenses Ledger</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wipeHandovers}
                  onChange={e => setWipeHandovers(e.target.checked)}
                  className="rounded border-slate-600 text-red-500 focus:ring-red-500"
                />
                <span>Shift Handovers & Z-Reports</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wipeCustomers}
                  onChange={e => setWipeCustomers(e.target.checked)}
                  className="rounded border-slate-600 text-red-500 focus:ring-red-500"
                />
                <span>Customers & VIP Accounts</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wipeAttendance}
                  onChange={e => setWipeAttendance(e.target.checked)}
                  className="rounded border-slate-600 text-red-500 focus:ring-red-500"
                />
                <span>Staff Attendance Records</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wipeDeliveries}
                  onChange={e => setWipeDeliveries(e.target.checked)}
                  className="rounded border-slate-600 text-red-500 focus:ring-red-500"
                />
                <span>Delivery Logs</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wipeSuppliers}
                  onChange={e => setWipeSuppliers(e.target.checked)}
                  className="rounded border-slate-600 text-red-500 focus:ring-red-500"
                />
                <span>Suppliers & Restock Orders</span>
              </label>

              <label className="flex items-center gap-2 text-amber-300 cursor-pointer col-span-1 sm:col-span-2 pt-1 border-t border-slate-700/60">
                <input
                  type="checkbox"
                  checked={wipeProducts}
                  onChange={e => setWipeProducts(e.target.checked)}
                  className="rounded border-amber-600 text-red-600 focus:ring-red-600"
                />
                <span>Wipe Product Catalog & Inventory (Warning: Clears all items)</span>
              </label>
            </div>
          </div>

          {/* Admin Credentials */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Admin Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  required
                  placeholder="admin@jambeautystore.com"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:outline-none focus:border-red-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Admin Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:outline-none focus:border-red-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Type <span className="font-mono text-red-400 font-bold">FACTORY RESET</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={e => setConfirmPhrase(e.target.value)}
                placeholder="FACTORY RESET"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none focus:border-red-400"
              />
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>{progressMsg}</span>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
