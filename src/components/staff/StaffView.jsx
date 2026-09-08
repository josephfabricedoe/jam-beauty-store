import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import StaffForm from './StaffForm';
import { UserPlus, Edit2, UserCheck, UserX, Shield, Users } from 'lucide-react';

export default function StaffView() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    return onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn('Users listener notice:', err.message || err);
        setLoading(false);
      }
    );
  }, []);

  const toggleActive = (member) =>
    updateDoc(doc(db, 'users', member.id), { active: !member.active });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Staff Management</h2>
          <p className="text-xs text-slate-500">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-rose-500/20">
          <UserPlus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {loading ? <p className="text-slate-500 text-sm">Loading...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {staff.map(member => (
            <div key={member.id} className={`bg-slate-800/50 border rounded-2xl p-4 transition-opacity ${
              member.active === false ? 'opacity-50 border-slate-800' : 'border-slate-700 hover:border-slate-600'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-white">
                      {(member.displayName || member.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm truncate">{member.displayName || '—'}</p>
                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${
                  member.role === 'admin'
                    ? 'bg-rose-900/50 text-rose-300 border-rose-700/50'
                    : 'bg-slate-700 text-slate-300 border-slate-600'
                }`}>
                  {member.role === 'admin' ? <span className="flex items-center gap-1"><Shield className="w-3 h-3" />Admin</span> : 'Staff'}
                </span>
              </div>

              {/* Pay & Shift Details */}
              <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 border border-slate-700/50 rounded-xl px-3 py-2 my-2">
                <div>
                  <span className="text-slate-500">Pay Rate:</span>{' '}
                  <span className="text-emerald-400 font-bold">
                    {member.hourlyRate ? `$${Number(member.hourlyRate).toFixed(2)}/hr` : 'Not set'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate max-w-[140px]" title={member.shiftSchedule || 'Full Day'}>
                  {member.shiftSchedule || 'Full Day'}
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700">
                <button onClick={() => setEditStaff(member)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                {member.pin && <span className="text-xs text-slate-600 ml-1">PIN: ••••</span>}
                {member.id !== currentUser?.uid && (
                  <button onClick={() => toggleActive(member)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ml-auto ${
                      member.active === false
                        ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400'
                        : 'bg-red-900/20 hover:bg-red-900/40 text-red-400'
                    }`}>
                    {member.active === false
                      ? <><UserCheck className="w-3 h-3" />Reactivate</>
                      : <><UserX className="w-3 h-3" />Deactivate</>}
                  </button>
                )}
              </div>
            </div>
          ))}
          {staff.length === 0 && (
            <div className="col-span-3 text-center py-12 text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No staff yet. Add one to get started.</p>
            </div>
          )}
        </div>
      )}

      <StaffForm isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <StaffForm isOpen={!!editStaff} onClose={() => setEditStaff(null)} editStaff={editStaff} />
    </div>
  );
}
