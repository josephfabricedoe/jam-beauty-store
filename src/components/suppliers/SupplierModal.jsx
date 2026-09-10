import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Save, Trash2, AlertCircle, Building2, Phone, Mail, Clock, CreditCard, MapPin } from 'lucide-react';

const PAYMENT_TERMS_OPTIONS = [
  'Cash on Delivery (COD)',
  'Net 7 Days',
  'Net 15 Days',
  'Net 30 Days',
  'Net 60 Days',
  'Advance Payment / Pre-paid',
  'Consignment',
];

export default function SupplierModal({ isOpen, onClose, editSupplier = null }) {
  const isEdit = !!editSupplier;

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState('Cash on Delivery (COD)');
  const [leadTimeDays, setLeadTimeDays] = useState('5');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editSupplier) {
        setName(editSupplier.name || '');
        setCode(editSupplier.code || '');
        setContactPerson(editSupplier.contactPerson || '');
        setPhone(editSupplier.phone || '');
        setEmail(editSupplier.email || '');
        setTerms(editSupplier.terms || 'Cash on Delivery (COD)');
        setLeadTimeDays(editSupplier.leadTimeDays != null ? String(editSupplier.leadTimeDays) : '5');
        setAddress(editSupplier.address || '');
        setNotes(editSupplier.notes || '');
        setActive(editSupplier.active !== false);
      } else {
        setName('');
        setCode(`SUP-${Math.floor(1000 + Math.random() * 9000)}`);
        setContactPerson('');
        setPhone('');
        setEmail('');
        setTerms('Cash on Delivery (COD)');
        setLeadTimeDays('5');
        setAddress('');
        setNotes('');
        setActive(true);
      }
      setError('');
      setConfirmDelete(false);
    }
  }, [isOpen, editSupplier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Supplier name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        name: name.trim(),
        code: code.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        terms: terms.trim(),
        leadTimeDays: parseInt(leadTimeDays, 10) || 0,
        address: address.trim(),
        notes: notes.trim(),
        active: Boolean(active),
        updatedAt: serverTimestamp(),
      };

      if (isEdit && editSupplier.id) {
        await setDoc(doc(db, 'suppliers', editSupplier.id), data, { merge: true });
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'suppliers'), data);
      }

      onClose();
    } catch (err) {
      console.error('Error saving supplier:', err);
      setError(err.message || 'Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !editSupplier?.id) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'suppliers', editSupplier.id));
      onClose();
    } catch (err) {
      console.error('Error deleting supplier:', err);
      setError(err.message || 'Failed to delete supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Supplier: ${editSupplier.name}` : 'New Supplier'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Supplier Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Supplier / Company Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Glam Beauty Wholesale & Imports"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Supplier Code */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Supplier Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SUP-1001"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Contact Person / Rep
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Sarah Jenkins (Account Rep)"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Phone / WhatsApp
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0770000000 or 231..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="orders@supplier.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Payment Terms
            </label>
            <div className="relative">
              <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500 appearance-none"
              >
                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lead Time (Days) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Avg. Lead Time (Days)
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="number"
                min="0"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                placeholder="5"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Physical Address / Location */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Warehouse / Order Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Randall Street, Monrovia or Dubai Logistics Hub"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Notes & Order Policies
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Minimum order $300 for free delivery. Offers 5% discount on prompt settlement."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Active status */}
          <div className="sm:col-span-2 flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div>
              <p className="text-sm font-medium text-white">Active Supplier Status</p>
              <p className="text-xs text-slate-400">Deactivated suppliers can be restored at any time</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          {isEdit ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Supplier
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEdit ? 'Update Supplier' : 'Create Supplier'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
