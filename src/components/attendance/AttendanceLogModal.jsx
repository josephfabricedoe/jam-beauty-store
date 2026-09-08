import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Save, Trash2, AlertCircle, Clock } from 'lucide-react';

export default function AttendanceLogModal({ isOpen, onClose, editRecord = null, staffList = [] }) {
  const isEdit = !!editRecord;

  const [staffId, setStaffId] = useState('');
  const [action, setAction] = useState('clockIn');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editRecord) {
        setStaffId(editRecord.staffId || '');
        setAction(editRecord.action || 'clockIn');
        setNote(editRecord.note || '');

        const dateObj = editRecord.timestamp?.toDate ? editRecord.timestamp.toDate() : new Date();
        setDate(dateObj.toISOString().slice(0, 10));
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const mm = String(dateObj.getMinutes()).padStart(2, '0');
        setTime(`${hh}:${mm}`);
      } else {
        setStaffId(staffList[0]?.id || '');
        setAction('clockIn');
        setNote('Manager manual log');
        const now = new Date();
        setDate(now.toISOString().slice(0, 10));
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        setTime(`${hh}:${mm}`);
      }
      setError('');
      setConfirmDelete(false);
    }
  }, [isOpen, editRecord, staffList]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!staffId) {
      setError('Please select a staff member.');
      return;
    }
    if (!date || !time) {
      setError('Please provide date and time.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const selectedStaff = staffList.find(s => s.id === staffId);
      const staffName = selectedStaff?.displayName || selectedStaff?.email || 'Staff';

      // Parse custom date and time into Timestamp
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const combinedDate = new Date(year, month - 1, day, hours, minutes, 0);

      const payload = {
        staffId,
        staffName,
        action,
        timestamp: Timestamp.fromDate(combinedDate),
        note: note.trim() || 'Manual adjustment by Admin',
        adjustedByAdmin: true,
      };

      if (isEdit) {
        await updateDoc(doc(db, 'attendance', editRecord.id), payload);
      } else {
        await addDoc(collection(db, 'attendance'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'attendance', editRecord.id));
      onClose();
    } catch (err) {
      setError('Delete failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Attendance Record' : 'Add Manual Attendance Log'}
      size="md"
      footer={
        <div className="flex items-center gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                confirmDelete
                  ? 'bg-red-500 text-white'
                  : 'bg-red-900/20 text-red-400 hover:bg-red-900/40'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmDelete ? 'Confirm Delete?' : 'Delete Log'}
            </button>
          )}

          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              form="attendance-log-form"
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#efaa9b] hover:bg-[#e89887] disabled:opacity-50 text-[#45150b] rounded-xl text-sm font-bold transition-colors shadow-lg shadow-[#efaa9b]/20"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Record Log'}
            </button>
          </div>
        </div>
      }
    >
      <form id="attendance-log-form" onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="text-xs text-red-400 flex items-center gap-2 bg-red-900/20 border border-red-800/40 p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Staff Member *</label>
          <select
            value={staffId}
            onChange={e => setStaffId(e.target.value)}
            required
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
          >
            <option value="">— Select Employee —</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>
                {s.displayName || s.email} {s.role ? `(${s.role})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Action *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction('clockIn')}
              className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                action === 'clockIn'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              🟢 Clock In (Arrival)
            </button>
            <button
              type="button"
              onClick={() => setAction('clockOut')}
              className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                action === 'clockOut'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              🔴 Clock Out (Departure)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Time *</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Reason / Adjustment Note
          </label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Phone dead at closing, shift approved by CEO"
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
          />
        </div>
      </form>
    </Modal>
  );
}
