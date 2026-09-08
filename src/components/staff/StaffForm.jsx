import React, { useState } from 'react';
import Modal from '../shared/Modal';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { UserPlus } from 'lucide-react';

export default function StaffForm({ isOpen, onClose, editStaff = null }) {
  const isEdit = !!editStaff;
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    role: 'staff',
    pin: '',
    password: '',
    hourlyRate: '',
    shiftSchedule: 'Full Day (8:30 AM - 5:30 PM)',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (isOpen) {
      if (editStaff) {
        setForm({
          displayName: editStaff.displayName || '',
          email: editStaff.email || '',
          role: editStaff.role || 'staff',
          pin: editStaff.pin || '',
          password: '',
          hourlyRate: editStaff.hourlyRate != null ? String(editStaff.hourlyRate) : '',
          shiftSchedule: editStaff.shiftSchedule || 'Full Day (8:30 AM - 5:30 PM)',
        });
      } else {
        setForm({
          displayName: '',
          email: '',
          role: 'staff',
          pin: '',
          password: '',
          hourlyRate: '',
          shiftSchedule: 'Full Day (8:30 AM - 5:30 PM)',
        });
      }
      setError('');
    }
  }, [isOpen, editStaff]);

  const handleSave = async (e) => {
    e.preventDefault(); setError('');
    if (form.pin && (form.pin.length !== 4 || !/^\d{4}$/.test(form.pin))) {
      setError('PIN must be exactly 4 digits.'); return;
    }
    setSaving(true);
    try {
      const payload = {
        displayName: form.displayName,
        role: form.role,
        pin: form.pin,
        hourlyRate: parseFloat(form.hourlyRate) || 0,
        shiftSchedule: form.shiftSchedule || 'Full Day (8:30 AM - 5:30 PM)',
        updatedAt: serverTimestamp(),
      };

      if (isEdit) {
        await updateDoc(doc(db, 'users', editStaff.id), payload);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await updateProfile(cred.user, { displayName: form.displayName });
        await setDoc(doc(db, 'users', cred.user.uid), {
          ...payload,
          uid: cred.user.uid,
          email: form.email,
          active: true,
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Invalid email address.',
      };
      setError(msgs[err.code] || err.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={isEdit ? `Edit Staff — ${editStaff.displayName || editStaff.email}` : 'Add New Staff Member'}
      size="md"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
          <button form="staff-form" type="submit" disabled={saving}
            className="flex-1 py-2.5 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] disabled:opacity-50 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1 shadow-md shadow-[#efaa9b]/20">
            <UserPlus className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      }
    >
      <form id="staff-form" onSubmit={handleSave} className="space-y-3.5">
        {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</p>}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block">Full Name *</label>
          <input required value={form.displayName} onChange={e => set('displayName', e.target.value)}
            placeholder="e.g. Jane Smith"
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]" />
        </div>
        {!isEdit && (<>
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">Email Address *</label>
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="staff@example.com"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">Password * (min 6 chars)</label>
            <input required type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]" />
          </div>
        </>)}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]">
              <option value="staff">Staff Member</option>
              <option value="admin">Store Admin / Manager</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1 block">4-Digit Clock-In PIN</label>
            <input type="password" maxLength={4} value={form.pin}
              onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0,4))}
              placeholder="••••"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm text-center tracking-widest focus:outline-none focus:border-[#efaa9b]" />
          </div>
        </div>

        {/* Hourly Pay & Shift Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-700 pt-3">
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
            <span className="text-[11px] text-slate-400 mt-1 block">Used for monthly payroll (26th–25th).</span>
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
            <span className="text-[11px] text-slate-400 mt-1 block">Expected working hours.</span>
          </div>
        </div>

        {!isEdit && (
          <p className="text-xs text-slate-400 bg-slate-700/30 rounded-xl p-3">
            Creates a store login account. Staff can sign into the POS, Inventory, and Attendance with their email and password.
          </p>
        )}
      </form>
    </Modal>
  );
}
