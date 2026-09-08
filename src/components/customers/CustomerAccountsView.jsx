import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import Modal from '../shared/Modal';
import {
  Users, UserPlus, Phone, CreditCard, Search, DollarSign,
  AlertCircle, CheckCircle, Clock, ArrowDownRight, Edit2, ShieldAlert
} from 'lucide-react';

const CUSTOMER_TYPES = ['Salon / Hair Stylist', 'Wholesale Reseller', 'VIP Client', 'Regular Retail'];

export default function CustomerAccountsView() {
  const { format } = useCurrency();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Customer Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState('Salon / Hair Stylist');
  const [creditLimit, setCreditLimit] = useState('500');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const openAddModal = () => {
    setEditCustomer(null);
    setName('');
    setPhone('');
    setCustomerType('Salon / Hair Stylist');
    setCreditLimit('500');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditCustomer(c);
    setName(c.name || '');
    setPhone(c.phone || '');
    setCustomerType(c.customerType || 'Salon / Hair Stylist');
    setCreditLimit(String(c.creditLimit || '500'));
    setError('');
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        customerType,
        creditLimit: parseFloat(creditLimit) || 0,
        updatedAt: serverTimestamp(),
      };

      if (editCustomer) {
        await updateDoc(doc(db, 'customers', editCustomer.id), payload);
      } else {
        await addDoc(collection(db, 'customers'), {
          ...payload,
          balanceOwed: 0,
          totalSpent: 0,
          createdAt: serverTimestamp(),
        });
      }
      setModalOpen(false);
    } catch (err) {
      setError('Failed to save customer: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Record payment towards outstanding balance
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSaving(true);
    try {
      const newBalance = Math.max(0, (selectedCustomer.balanceOwed || 0) - amount);
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        balanceOwed: newBalance,
        lastPaymentAmount: amount,
        lastPaymentDate: serverTimestamp(),
      });

      // Log payment record in customerPayments
      await addDoc(collection(db, 'customerPayments'), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        amount,
        note: paymentNote.trim() || 'Debt payment',
        timestamp: serverTimestamp(),
      });

      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (err) {
      alert('Payment failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.customerType || '').toLowerCase().includes(q);
  });

  const totalOwed = customers.reduce((sum, c) => sum + (c.balanceOwed || 0), 0);
  const totalSpentAll = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#efaa9b]" />
            <span>Customers & VIP Accounts</span>
          </h2>
          <p className="text-xs text-slate-400">Client profiles, store credit balances & payment tracking</p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-bold transition-colors shadow-md shadow-[#efaa9b]/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Account</span>
        </button>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Registered Clients</p>
          <p className="text-xl font-bold text-white mt-0.5">{customers.length} Accounts</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Outstanding Debt (Store Credit)</p>
          <p className="text-xl font-bold text-red-400 mt-0.5">{format(totalOwed)}</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Lifetime Sales</p>
          <p className="text-xl font-bold text-emerald-400 mt-0.5">{format(totalSpentAll)}</p>
        </div>
      </div>

      {/* Search & Customer Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by customer name, VIP account or phone..."
              className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#efaa9b]"
            />
          </div>
          <span className="text-xs text-slate-400">{filteredCustomers.length} accounts</span>
        </div>

        {loading ? (
          <p className="text-slate-500 text-xs py-8 text-center">Loading accounts...</p>
        ) : filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <th className="text-left px-3 py-2.5">Customer / VIP Name</th>
                  <th className="text-left px-3 py-2.5">Type</th>
                  <th className="text-left px-3 py-2.5">Phone Number</th>
                  <th className="text-right px-3 py-2.5">Total Spent</th>
                  <th className="text-right px-3 py-2.5">Balance Owed</th>
                  <th className="text-center px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/60 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-white">
                      {c.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      <span className="bg-slate-700 px-2 py-0.5 rounded text-[11px]">
                        {c.customerType || 'Salon'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-300">
                      {c.phone || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-400 font-semibold">
                      {format(c.totalSpent || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {(c.balanceOwed || 0) > 0 ? (
                        <span className="text-red-400 font-bold bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded">
                          {format(c.balanceOwed)}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-medium">Clear ($0.00)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {(c.balanceOwed || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setPaymentAmount(String(c.balanceOwed));
                              setPaymentModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            Receive Payment
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No customer accounts registered yet.</p>
            <p className="text-xs mt-1">Add wholesale salon clients or VIP shoppers to track their accounts.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editCustomer ? `Edit Account — ${editCustomer.name}` : 'Register New Customer / VIP Account'}
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              form="customer-account-form"
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-bold transition-colors shadow-md shadow-[#efaa9b]/20"
            >
              {saving ? 'Saving...' : editCustomer ? 'Save Changes' : 'Register Account'}
            </button>
          </div>
        }
      >
        <form id="customer-account-form" onSubmit={handleSaveCustomer} className="space-y-3.5">
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 p-2.5 rounded-xl">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Customer / Account Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Jessica Doe / VIP Client"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number (WhatsApp)
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 0770123456"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Client Category
              </label>
              <select
                value={customerType}
                onChange={e => setCustomerType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
              >
                {CUSTOMER_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Store Credit Limit ($ USD)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              value={creditLimit}
              onChange={e => setCreditLimit(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Maximum credit allowance allowed for this customer on credit purchases.
            </span>
          </div>
        </form>
      </Modal>

      {/* Receive Payment Modal */}
      {paymentModalOpen && selectedCustomer && (
        <Modal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title={`Receive Debt Payment — ${selectedCustomer.name}`}
          size="sm"
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                form="customer-payment-form"
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                {saving ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          }
        >
          <form id="customer-payment-form" onSubmit={handleRecordPayment} className="space-y-3">
            <div className="bg-slate-900/40 border border-slate-700 p-3 rounded-xl">
              <p className="text-[11px] text-slate-400">Total Outstanding Debt:</p>
              <p className="text-lg font-bold text-red-400">{format(selectedCustomer.balanceOwed || 0)}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Payment Amount ($ USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedCustomer.balanceOwed}
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Note / Reference (Optional)
              </label>
              <input
                type="text"
                value={paymentNote}
                onChange={e => setPaymentNote(e.target.value)}
                placeholder="e.g. Paid in Cash at counter / MoMo"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
