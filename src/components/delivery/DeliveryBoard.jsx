import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp, orderBy, query
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../shared/Modal';
import { PlusCircle, Truck, MapPin, Phone, Clock, DollarSign, CheckCircle2, AlertCircle, Download, Lock } from 'lucide-react';
import { downloadCSV } from '../../utils/exportCsv';

const STATUS_STYLES = {
  Pending: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  Paid:    'bg-green-900/50  text-green-400  border-green-700/50',
  MoMo:   'bg-blue-900/50   text-blue-400   border-blue-700/50',
  COD:     'bg-amber-900/50  text-amber-400  border-amber-700/50',
};

const EMPTY_FORM = {
  customer: '',
  destination: '',
  riderId: '',
  contact: '',
  charge: '',
  productCost: '',
  paymentStatus: 'COD',
  pickupTime: '',
  returnTime: '', // Left open initially
  note: '',
};

export default function DeliveryBoard() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmCashModal, setConfirmCashModal] = useState(null);
  const [returnTimeModal, setReturnTimeModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Cash confirmation form state
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [cashierNameInput, setCashierNameInput] = useState('');

  // Return time input state
  const [customReturnTime, setCustomReturnTime] = useState('');

  const { format } = useCurrency();
  const { currentUser, userProfile } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'deliveries'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, snap => {
      setDeliveries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const chargeNum = parseFloat(form.charge) || 0;
      const productCostNum = parseFloat(form.productCost) || 0;

      await addDoc(collection(db, 'deliveries'), {
        ...form,
        charge: chargeNum,
        productCost: productCostNum,
        totalExpectedCash: form.paymentStatus === 'COD' ? (chargeNum + productCostNum) : chargeNum,
        cashConfirmed: false,
        cashConfirmedBy: '',
        cashCollectedAmount: 0,
        returnTime: form.returnTime || '', // left open for rider
        timestamp: serverTimestamp(),
      });

      setAddOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      alert('Failed to add delivery: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, 'deliveries', id), { paymentStatus: status });
  };

  // Open cashier cash confirmation dialog
  const openConfirmCash = (delivery) => {
    const expected = delivery.paymentStatus === 'COD'
      ? ((delivery.charge || 0) + (delivery.productCost || 0))
      : (delivery.charge || 0);

    setCashAmountInput(delivery.cashCollectedAmount ? String(delivery.cashCollectedAmount) : String(expected));
    setCashierNameInput(userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Cashier');
    setConfirmCashModal(delivery);
  };

  const submitCashConfirmation = async (e) => {
    e.preventDefault();
    if (!confirmCashModal) return;
    setSaving(true);
    try {
      const amount = parseFloat(cashAmountInput) || 0;
      await updateDoc(doc(db, 'deliveries', confirmCashModal.id), {
        cashConfirmed: true,
        cashConfirmedBy: cashierNameInput.trim() || 'Cashier',
        cashCollectedAmount: amount,
        cashConfirmedAt: serverTimestamp(),
        paymentStatus: 'Paid', // Mark as paid once confirmed by cashier
      });
      setConfirmCashModal(null);
    } catch (err) {
      alert('Failed to confirm cash: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Open return time dialog for rider
  const openSetReturnTime = (delivery) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setCustomReturnTime(delivery.returnTime || timeStr);
    setReturnTimeModal(delivery);
  };

  const submitReturnTime = async (e) => {
    e.preventDefault();
    if (!returnTimeModal) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'deliveries', returnTimeModal.id), {
        returnTime: customReturnTime,
        returnedAt: serverTimestamp(),
      });
      setReturnTimeModal(null);
    } catch (err) {
      alert('Failed to record return time: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    const data = deliveries.map(d => {
      const dateObj = d.timestamp?.toDate ? d.timestamp.toDate() : null;
      return {
        date: dateObj ? dateObj.toLocaleDateString() : '',
        customer: d.customer || '',
        destination: d.destination || '',
        rider: d.riderId || '',
        contact: d.contact || '',
        deliveryFee: (d.charge || 0).toFixed(2),
        productCost: (d.productCost || 0).toFixed(2),
        totalToCollect: ((d.charge || 0) + (d.productCost || 0)).toFixed(2),
        paymentStatus: d.paymentStatus || '',
        departureTime: d.pickupTime || '',
        returnTime: d.returnTime || 'Open',
        cashConfirmed: d.cashConfirmed ? 'YES' : 'NO',
        cashierConfirmedBy: d.cashConfirmedBy || '',
        notes: d.note || '',
      };
    });

    const headers = {
      date: 'Date',
      customer: 'Customer Name',
      destination: 'Destination',
      rider: 'Rider Name',
      contact: 'Contact Phone',
      deliveryFee: 'Delivery Fee ($)',
      productCost: 'Product Cost ($)',
      totalToCollect: 'Total Cash to Collect ($)',
      paymentStatus: 'Payment Status',
      departureTime: 'Departure Time',
      returnTime: 'Return Time',
      cashConfirmed: 'Cash Confirmed by Cashier',
      cashierConfirmedBy: 'Cashier Name',
      notes: 'Delivery Notes',
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jam_beauty_deliveries_${todayStr}.csv`, data, headers);
  };

  if (loading) return <div className="text-slate-500 p-4 text-sm">Loading deliveries...</div>;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Delivery Logistics</h2>
          <p className="text-xs text-slate-500">
            {deliveries.length} delivery {deliveries.length === 1 ? 'order' : 'orders'} tracked
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-[#efaa9b]/60 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#efaa9b]" />
            <span>Export Deliveries (CSV)</span>
          </button>

          <button
            onClick={() => {
              const now = new Date();
              const pickup = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              setForm({ ...EMPTY_FORM, pickupTime: pickup });
              setAddOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-sm font-bold transition-colors shadow-lg shadow-[#efaa9b]/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Delivery</span>
          </button>
        </div>
      </div>

      {/* Delivery Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {deliveries.map(d => {
          const totalExpected = (d.charge || 0) + (d.productCost || 0);

          return (
            <div
              key={d.id}
              className="bg-slate-800/60 border border-slate-700 hover:border-slate-600 rounded-2xl p-4 space-y-3 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-base truncate">{d.customer}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                      <span className="truncate">{d.destination}</span>
                    </p>
                  </div>
                  <select
                    value={d.paymentStatus || 'COD'}
                    onChange={e => updateStatus(d.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-lg border bg-transparent focus:outline-none cursor-pointer flex-shrink-0 ${STATUS_STYLES[d.paymentStatus] || STATUS_STYLES.COD}`}
                  >
                    {['Pending', 'Paid', 'MoMo', 'COD'].map(s => (
                      <option key={s} value={s} className="bg-slate-800 text-white">{s}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/50">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                    <span className="truncate font-medium">{d.riderId || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                    <span className="truncate">{d.contact || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                    <span>Depart: {d.pickupTime || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                    <span>Return: {d.returnTime || 'Open'}</span>
                  </div>
                </div>

                {d.note && (
                  <p className="text-xs text-slate-400 italic mt-2 bg-slate-700/20 px-2 py-1 rounded">
                    "{d.note}"
                  </p>
                )}

                {/* Amount breakdown */}
                <div className="mt-3 space-y-1 text-xs border-t border-slate-700/60 pt-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Delivery Charge:</span>
                    <span className="text-white font-medium">{format(d.charge || 0)}</span>
                  </div>
                  {d.productCost > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Products Cost (Rider Handled):</span>
                      <span className="text-white font-medium">{format(d.productCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-rose-300 border-t border-dashed border-slate-700 pt-1">
                    <span>Total Cash to Collect:</span>
                    <span>{format(totalExpected)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Cash Confirmation & Rider Return Time */}
              <div className="space-y-2 pt-2 border-t border-slate-700">
                {/* Cashier confirmation badge or button */}
                {d.cashConfirmed ? (
                  <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Cash Confirmed: {format(d.cashCollectedAmount || 0)}
                    </span>
                    <span className="text-[10px] text-emerald-400/80">by {d.cashConfirmedBy}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => openConfirmCash(d)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-medium transition-colors"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Cashier: Confirm Cash Received
                  </button>
                )}

                {/* Rider return time — locked permanently once recorded */}
                {!d.returnTime ? (
                  <button
                    onClick={() => openSetReturnTime(d)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-medium transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Rider: Record Return Time</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/60 px-2.5 py-1.5 rounded-xl text-xs">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Returned at: <strong className="text-white">{d.returnTime}</strong></span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {deliveries.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 text-slate-600">
            <Truck className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm">No deliveries yet.</p>
            <p className="text-xs mt-1">Click "New Delivery" to add one.</p>
          </div>
        )}
      </div>

      {/* New Delivery Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="New Delivery Order"
        size="md"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setAddOpen(false)}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              form="delivery-form"
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-rose-500/20"
            >
              {saving ? 'Adding...' : 'Add Delivery'}
            </button>
          </div>
        }
      >
        <form id="delivery-form" onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Customer Name *</label>
              <input
                required
                value={form.customer}
                onChange={e => setF('customer', e.target.value)}
                placeholder="e.g. Marie Cooper"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Destination *</label>
              <input
                required
                value={form.destination}
                onChange={e => setF('destination', e.target.value)}
                placeholder="e.g. Sinkor 15th St"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Rider / Agent Name</label>
              <input
                value={form.riderId}
                onChange={e => setF('riderId', e.target.value)}
                placeholder="e.g. Samuel"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Customer Phone</label>
              <input
                value={form.contact}
                onChange={e => setF('contact', e.target.value)}
                placeholder="0770..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Delivery Fee ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.charge}
                onChange={e => setF('charge', e.target.value)}
                placeholder="3.00"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Product Cost to Collect ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.productCost}
                onChange={e => setF('productCost', e.target.value)}
                placeholder="0.00 (if COD)"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Departure / Pickup Time</label>
              <input
                type="time"
                value={form.pickupTime}
                onChange={e => setF('pickupTime', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Payment Status</label>
              <select
                value={form.paymentStatus}
                onChange={e => setF('paymentStatus', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              >
                {['COD', 'Pending', 'Paid', 'MoMo'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Return Time</label>
            <p className="text-[11px] text-slate-500 mb-1 italic">
              Left open by default — the rider will enter this upon returning.
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Delivery Note</label>
            <input
              value={form.note}
              onChange={e => setF('note', e.target.value)}
              placeholder="e.g. Call before arrival, handle with care"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
            />
          </div>
        </form>
      </Modal>

      {/* Cashier Confirm Cash Modal */}
      {confirmCashModal && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmCashModal(null)}
          title="Confirm Cash Received from Rider"
          size="sm"
          footer={
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCashModal(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                form="confirm-cash-form"
                type="submit"
                disabled={saving}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-emerald-600/20"
              >
                {saving ? 'Saving...' : 'Confirm Cash'}
              </button>
            </div>
          }
        >
          <form id="confirm-cash-form" onSubmit={submitCashConfirmation} className="space-y-4">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Customer:</span>
                <span className="text-white font-medium">{confirmCashModal.customer}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Rider:</span>
                <span className="text-white font-medium">{confirmCashModal.riderId || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Delivery Fee:</span>
                <span className="text-white font-medium">{format(confirmCashModal.charge || 0)}</span>
              </div>
              {confirmCashModal.productCost > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Product Cost:</span>
                  <span className="text-white font-medium">{format(confirmCashModal.productCost)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-rose-300 border-t border-slate-700 pt-1">
                <span>Expected Total:</span>
                <span>{format((confirmCashModal.charge || 0) + (confirmCashModal.productCost || 0))}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 mb-1 block font-medium">
                Actual Cash Amount Brought Back ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={cashAmountInput}
                onChange={e => setCashAmountInput(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-base font-bold focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 mb-1 block font-medium">
                Cashier Confirming Name *
              </label>
              <input
                required
                value={cashierNameInput}
                onChange={e => setCashierNameInput(e.target.value)}
                placeholder="Cashier Name"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Rider Record Return Time Modal */}
      {returnTimeModal && (
        <Modal
          isOpen={true}
          onClose={() => setReturnTimeModal(null)}
          title="Record Rider Return Time"
          size="sm"
          footer={
            <div className="flex gap-2">
              <button
                onClick={() => setReturnTimeModal(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                form="return-time-form"
                type="submit"
                disabled={saving}
                className="flex-1 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {saving ? 'Saving...' : 'Save Return Time'}
              </button>
            </div>
          }
        >
          <form id="return-time-form" onSubmit={submitReturnTime} className="space-y-3">
            <p className="text-xs text-slate-400">
              Record the time rider <strong>{returnTimeModal.riderId || 'Rider'}</strong> returned to the store from <strong>{returnTimeModal.destination}</strong>:
            </p>
            <div>
              <label className="text-xs text-slate-300 mb-1 block font-medium">Return Time</label>
              <input
                type="time"
                required
                value={customReturnTime}
                onChange={e => setCustomReturnTime(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-base focus:outline-none focus:border-rose-400"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
