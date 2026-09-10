import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import StaffForm from './StaffForm';
import Modal from '../shared/Modal';
import { UserPlus, Edit2, UserCheck, UserX, Shield, Users, Trash2, KeyRound, Crown } from 'lucide-react';
import { ROLE_DEFINITIONS, normalizeRole, isOwnerEmail } from '../../utils/rbac';

export default function StaffView() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);
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

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err) {
      console.error('Failed to delete staff:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Staff & Clearance Directory</h2>
          <p className="text-xs text-slate-400">
            Configure 4-digit PINs, pay rates, shift schedules, and authority clearances ({staff.length} registered)
          </p>
        </div>
        <button 
          onClick={() => setAddOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#efaa9b]/20"
        >
          <UserPlus className="w-4 h-4" /> Add Team Member
        </button>
      </div>

      {/* Terminal info header */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#efaa9b] flex-shrink-0" />
          <span>Store Register Terminal: <strong className="text-white">Jambeautyliberia@gmail.com</strong> (Password: <code className="text-slate-200">Jam2Liberia</code>)</span>
        </div>
        <span className="text-[11px] text-[#efaa9b]">Staff members punch their unique 4-digit PIN to clock in</span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading staff members...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {staff.map(member => {
            const isFounder = isOwnerEmail(member.email);
            const roleDef = ROLE_DEFINITIONS[normalizeRole(member.role, member.email)] || ROLE_DEFINITIONS.cashier;

            return (
              <div 
                key={member.id} 
                className={`bg-slate-800/50 border rounded-2xl p-4 transition-all ${
                  member.active === false 
                    ? 'opacity-50 border-slate-800' 
                    : isFounder 
                      ? 'border-purple-500/40 shadow-sm shadow-purple-500/10' 
                      : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isFounder 
                        ? 'bg-gradient-to-br from-purple-500 to-amber-400 text-white font-black shadow-md' 
                        : 'bg-gradient-to-br from-rose-400 to-amber-400 text-white font-bold'
                    }`}>
                      {isFounder ? <Crown className="w-5 h-5" /> : (member.displayName || member.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-white text-sm truncate">{member.displayName || 'Unnamed'}</p>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{member.email}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold flex-shrink-0 ${roleDef.badgeColor}`}>
                    {roleDef.badge}
                  </span>
                </div>

                {/* Pay & Shift Details */}
                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 my-2">
                  <div>
                    <span className="text-slate-500">Pay Rate:</span>{' '}
                    <span className="text-emerald-400 font-bold">
                      {member.hourlyRate ? `$${Number(member.hourlyRate).toFixed(2)}/hr` : '—'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate max-w-[140px]" title={member.shiftSchedule || 'Full Day'}>
                    {member.shiftSchedule || 'Full Day'}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700/70">
                  {isFounder ? (
                    <span className="text-[11px] font-medium text-purple-300/90 py-1 inline-flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-purple-400" />
                      Permanent Founder Account
                    </span>
                  ) : (
                    <>
                      <button 
                        onClick={() => setEditStaff(member)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Edit2 className="w-3 h-3 text-[#efaa9b]" /> Edit
                      </button>

                      {member.pin && (
                        <span className="text-[11px] font-mono font-bold text-amber-300/90 bg-amber-950/40 border border-amber-800/40 px-2 py-1 rounded-md">
                          PIN: {member.pin}
                        </span>
                      )}

                      <button 
                        onClick={() => toggleActive(member)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ml-auto ${
                          member.active === false
                            ? 'bg-green-900/30 hover:bg-green-900/50 text-green-400'
                            : 'bg-slate-750 hover:bg-slate-700 text-slate-400'
                        }`}
                      >
                        {member.active === false
                          ? <><UserCheck className="w-3 h-3" /> Reactivate</>
                          : <><UserX className="w-3 h-3" /> Deactivate</>}
                      </button>

                      <button 
                        onClick={() => setDeleteCandidate(member)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Permanently Delete Staff Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {staff.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No staff registered yet. Click "Add Team Member" to add one.</p>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      <StaffForm isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <StaffForm isOpen={!!editStaff} onClose={() => setEditStaff(null)} editStaff={editStaff} />

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <Modal
          isOpen={!!deleteCandidate}
          onClose={() => setDeleteCandidate(null)}
          title="Delete Staff Member"
          size="sm"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1 shadow-lg shadow-rose-600/30"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          }
        >
          <div className="space-y-3 py-2 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto sm:mx-0">
              <Trash2 className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Permanently Remove Staff?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-white">{deleteCandidate.displayName || 'this staff member'}</strong>? Their secret 4-digit PIN (<span className="font-mono text-amber-300">{deleteCandidate.pin || 'None'}</span>) will no longer be valid on the store register.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
