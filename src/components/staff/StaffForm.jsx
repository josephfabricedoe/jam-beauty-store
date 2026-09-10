import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { doc, collection, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserPlus, KeyRound, Shield } from 'lucide-react';
import { SHARED_TERMINAL_EMAIL } from '../../utils/rbac';

export default function StaffForm({ isOpen, onClose, editStaff = null }) {
  const isEdit = !!editStaff;
  const [form, setForm] = useState({
    displayName: '',
    role: 'cashier',
    pin: '',
    hourlyRate: '',
    shiftSchedule: 'Full Day (8:30 AM - 5:30 PM)',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (isOpen) {
      if (editStaff) {
        setForm({
          displayName: editStaff.displayName || '',
          role: editStaff.role || 'cashier',
          pin: editStaff.pin || '',
          hourlyRate: editStaff.hourlyRate != null ? String(editStaff.hourlyRate) : '',
          shiftSchedule: editStaff.shiftSchedule || 'Full Day (8:30 AM - 5:30 PM)',
          phone: editStaff.phone || '',
        });
      } else {
        setForm({
          displayName: '',
          role: 'cashier',
          pin: '',
          hourlyRate: '',
          shiftSchedule: 'Full Day (8:30 AM - 5:30 PM)',
          phone: '',
        });
      }
      setError('');
    }
  }, [isOpen, editStaff]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = form.displayName.trim();
    if (!cleanName) {
      setError('Staff member name is required.');
      return;
    }

    const cleanPin = form.pin.trim();
    if (!cleanPin || cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setError('A unique 4-digit secret PIN is required for terminal clock-in.');
      return;
    }

    setSaving(true);
    try {
      // Check for PIN collision with existing active staff
      const snap = await getDocs(collection(db, 'users'));
      const collision = snap.docs.find(d => {
        if (isEdit && d.id === editStaff.id) return false;
        const data = d.data();
        return String(data.pin || '').trim() === cleanPin && data.active !== false;
      });

      if (collision) {
        setError(`PIN ${cleanPin} is already in use by ${collision.data().displayName || 'another staff member'}. Choose a different PIN.`);
        setSaving(false);
        return;
      }

      const payload = {
        displayName: cleanName,
        role: form.role,
        pin: cleanPin,
        hourlyRate: parseFloat(form.hourlyRate) || 0,
        shiftSchedule: form.shiftSchedule || 'Full Day (8:30 AM - 5:30 PM)',
        phone: form.phone.trim(),
        email: editStaff?.email || SHARED_TERMINAL_EMAIL,
        updatedAt: serverTimestamp(),
      };

      if (isEdit) {
        await updateDoc(doc(db, 'users', editStaff.id), payload);
      } else {
        await addDoc(collection(db, 'users'), {
          ...payload,
          active: true,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (err) {
      console.error('Error saving staff member:', err);
      setError(err.message || 'Failed to save staff member.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title={isEdit ? `Edit Staff — ${editStaff.displayName || editStaff.email}` : 'Add Team Member'}
      size="md"
      footer={
        <div className="flex gap-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            form="staff-form" 
            type="submit" 
            disabled={saving}
            className="flex-1 py-2.5 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] disabled:opacity-50 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1 shadow-md shadow-[#efaa9b]/20"
          >
            <UserPlus className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Team Member'}
          </button>
        </div>
      }
    >
      <form id="staff-form" onSubmit={handleSave} className="space-y-3.5">
        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* Store Terminal notice */}
        <div className="flex items-start gap-2.5 p-3 bg-slate-900/70 border border-slate-700 rounded-2xl text-xs text-slate-300">
          <KeyRound className="w-4 h-4 text-[#efaa9b] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold text-white">Store Register Account: </span>
            <span className="text-[#efaa9b] font-mono font-medium">Jambeautyliberia@gmail.com</span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              All store staff log into the computer terminal with this shared email (Password: <span className="font-mono text-white">Jam2Liberia</span>) and unlock their shift using their unique 4-digit PIN below.
            </p>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block">Staff Full Name *</label>
          <input 
            required 
            value={form.displayName} 
            onChange={e => set('displayName', e.target.value)}
            placeholder="e.g. Diamond, Sarah, Prince, etc."
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]" 
          />
        </div>

        {/* Role and PIN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">Clearance / Role *</label>
            <select 
              value={form.role} 
              onChange={e => set('role', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-xs font-medium focus:outline-none focus:border-[#efaa9b]"
            >
              <option value="delivery">🚚 Level 1: Delivery (Delivery & Clock-In only)</option>
              <option value="cashier">💳 Level 2: Cashier (POS, Deliveries, Customers)</option>
              <option value="manager">👔 Level 3: Manager (Finance, Stock, Marketing)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">
              4-Digit Secret PIN *
            </label>
            <input 
              required
              type="password" 
              maxLength={4} 
              value={form.pin}
              onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-base font-bold text-center tracking-widest focus:outline-none focus:border-[#efaa9b]" 
            />
          </div>
        </div>

        {/* Hourly Pay & Shift Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-700/60 pt-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">
              Pay Rate Per Hour ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
              <input
                type="number"
                step="0.10"
                min="0"
                value={form.hourlyRate}
                onChange={e => set('hourlyRate', e.target.value)}
                placeholder="e.g. 3.50"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl pl-8 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Used for payroll (26th–25th).</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">
              Shift Schedule Option
            </label>
            <select
              value={form.shiftSchedule}
              onChange={e => set('shiftSchedule', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            >
              <option value="Full Day (8:30 AM - 5:30 PM)">Full Day (8:30 AM - 5:30 PM)</option>
              <option value="Morning Shift (8:00 AM - 2:00 PM)">Morning Shift (8:00 AM - 2:00 PM)</option>
              <option value="Afternoon Shift (1:00 PM - 8:00 PM)">Afternoon Shift (1:00 PM - 8:00 PM)</option>
              <option value="Flexible / Open Hours">Flexible / Open Hours</option>
            </select>
          </div>
        </div>

        {/* Optional phone number */}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block">Phone Number (Optional)</label>
          <input 
            type="tel"
            value={form.phone} 
            onChange={e => set('phone', e.target.value)}
            placeholder="e.g. +231 88..."
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]" 
          />
        </div>

        <div className="text-[11px] text-slate-300 bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-1">
          <p className="font-bold text-[#efaa9b]">Confidentiality Clearance Guide:</p>
          <p>• <strong>Level 1 (Delivery):</strong> Only sees Delivery logistics board and Attendance clock-in.</p>
          <p>• <strong>Level 2 (Cashier):</strong> Delivery + POS register + Customer VIP phone lookups.</p>
          <p>• <strong>Level 3 (Manager):</strong> Finance reports, Stock management, WhatsApp. Restock/Suppliers & Settings are blocked.</p>
          <p>• <strong>Level 4 (Owner / CEO):</strong> Unrestricted master authority (Malydia Jasay & Joseph Doe).</p>
        </div>
      </form>
    </Modal>
  );
}
