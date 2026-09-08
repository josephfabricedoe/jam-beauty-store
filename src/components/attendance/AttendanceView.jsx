import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import ClockInMobile from './ClockInMobile';
import TimesheetAdmin from './TimesheetAdmin';
import { UserCheck, FileText, Clock, ShieldCheck } from 'lucide-react';

export default function AttendanceView() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const [activeTab, setActiveTab] = useState('timesheet'); // 'timesheet' | 'kiosk'
  const [staffList, setStaffList] = useState([]);

  // Fetch all staff members from Firestore users collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStaffList(list);
    }, (err) => {
      console.warn('Error listening to staff users:', err);
    });
    return unsub;
  }, []);

  // For non-admin staff: streamlined mobile clock-in only
  if (!isAdmin) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
            <Clock className="w-5 h-5 text-[#efaa9b]" />
            <span>Staff Attendance Clock</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Punch in at shift start and punch out at shift end</p>
        </div>
        <ClockInMobile />
      </div>
    );
  }

  // For Admin: Full tabbed interface (Timesheet Reports + Kiosk Clock In) on all devices
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* Admin Attendance Navigation Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#efaa9b]/20 border border-[#efaa9b]/30 flex items-center justify-center text-[#efaa9b]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Staff Attendance & Timesheets</h2>
            <p className="text-xs text-slate-400 hidden sm:block">Real-time attendance tracking, shift hours & manager adjustments</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('timesheet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'timesheet'
                ? 'bg-[#efaa9b] text-[#45150b] shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Timesheets & Reports</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kiosk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'kiosk'
                ? 'bg-[#efaa9b] text-[#45150b] shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Clock In Kiosk</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'timesheet' ? (
        <TimesheetAdmin staffList={staffList} />
      ) : (
        <div className="max-w-md mx-auto py-2">
          <ClockInMobile />
        </div>
      )}
    </div>
  );
}
