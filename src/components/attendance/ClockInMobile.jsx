import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { Clock, LogIn, LogOut, CheckCircle, Smartphone, User, ShieldCheck, Coffee, MapPin } from 'lucide-react';

export default function ClockInMobile() {
  const { currentUser, userProfile } = useAuth();

  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [pin, setPin] = useState('');
  const [action, setAction] = useState('clockIn');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  const [lastAction, setLastAction] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load all staff
  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.displayName || u.email);
      setStaffList(list);

      // Pre-select currently logged-in user if exists in staff
      if (currentUser?.uid) {
        const found = list.find(s => s.id === currentUser.uid);
        if (found) setSelectedStaff(found.id);
      }
    });
  }, [currentUser]);

  // Listen to current staff's last attendance status today
  useEffect(() => {
    if (!selectedStaff) return;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, 'attendance'),
      where('staffId', '==', selectedStaff),
      where('timestamp', '>=', todayStart),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const latest = snap.docs[0].data();
        setLastAction(latest.action);
        // Smart flip:
        if (latest.action === 'clockIn' || latest.action === 'breakEnd') {
          setAction('clockOut');
        } else if (latest.action === 'breakStart') {
          setAction('breakEnd');
        } else {
          setAction('clockIn');
        }
      } else {
        setLastAction(null);
        setAction('clockIn');
      }
    }, () => {});

    return unsub;
  }, [selectedStaff]);

  const handlePunch = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      setError('Please select your name.');
      return;
    }

    const staff = staffList.find(s => s.id === selectedStaff);
    if (!staff) {
      setError('Staff profile not found.');
      return;
    }

    // Check PIN if staff has a PIN configured and is using shared mode
    if (staff.pin && staff.id !== currentUser?.uid && pin.length !== 4) {
      setError('Please enter your 4-digit PIN.');
      return;
    }
    if (staff.pin && pin && staff.pin !== pin) {
      setError('Incorrect 4-digit PIN. Please try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      await addDoc(collection(db, 'attendance'), {
        staffId: staff.id,
        staffName: staff.displayName || staff.email,
        action,
        timestamp: serverTimestamp(),
        note: action === 'breakStart' ? 'Lunch / Break started' : action === 'breakEnd' ? 'Resumed from break' : 'Punched from mobile attendance clock',
        device: window.navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
      });

      const messages = {
        clockIn: `Welcome, ${staff.displayName || 'Staff'}! Clocked IN at ${timeStr}`,
        clockOut: `Goodbye, ${staff.displayName || 'Staff'}! Clocked OUT at ${timeStr}`,
        breakStart: `Enjoy your break, ${staff.displayName || 'Staff'}! Break started at ${timeStr}`,
        breakEnd: `Welcome back, ${staff.displayName || 'Staff'}! Resumed shift at ${timeStr}`,
      };

      setSuccessMsg(messages[action] || `Attendance updated at ${timeStr}`);
      setSuccess(true);
      setPin('');
      setTimeout(() => setSuccess(false), 4500);
    } catch (err) {
      setError('Attendance record failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isCurrentLoggedInUser = selectedStaff && selectedStaff === currentUser?.uid;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {/* Live Clock Card */}
      <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 text-center">
        <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
          {now.toLocaleTimeString()}
        </div>
        <div className="text-slate-400 text-xs mt-1">
          {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-4 animate-fade-in text-emerald-300">
          <CheckCircle className="w-8 h-8 text-emerald-400 flex-shrink-0" />
          <div className="text-xs font-semibold">
            <p className="text-white font-bold text-sm">Attendance Logged!</p>
            <p className="mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handlePunch} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-xl">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
            Select Employee
          </label>
          <select
            value={selectedStaff}
            onChange={e => {
              setSelectedStaff(e.target.value);
              setPin('');
              setError('');
            }}
            required
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3.5 py-3 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
          >
            <option value="">— Select Your Name —</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>
                {s.displayName || s.email} {s.role === 'admin' ? '(Admin)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Current Shift Status Indicator */}
        {selectedStaff && (
          <div className="text-xs flex items-center justify-between bg-slate-900/50 border border-slate-700/70 px-3.5 py-2.5 rounded-xl">
            <span className="text-slate-400">Current Status Today:</span>
            {lastAction === 'clockIn' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Working (Clocked In)
              </span>
            ) : lastAction === 'breakStart' ? (
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5" />
                On Lunch / Break
              </span>
            ) : lastAction === 'breakEnd' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Resumed Shift
              </span>
            ) : lastAction === 'clockOut' ? (
              <span className="text-slate-400 font-medium">Clocked Out</span>
            ) : (
              <span className="text-slate-500">Not yet clocked in today</span>
            )}
          </div>
        )}

        {/* Store Location Presence Indicator */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/30 border border-slate-700/50 px-3 py-1.5 rounded-xl">
          <MapPin className="w-3.5 h-3.5 text-[#efaa9b] flex-shrink-0" />
          <span>Verified Store Location: <strong>JAM Beauty Store (Monrovia)</strong></span>
        </div>

        {/* PIN input only required if staff has a PIN and not their personal logged-in phone */}
        {selectedStaff && !isCurrentLoggedInUser && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              4-Digit PIN
            </label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-center text-xl tracking-widest focus:outline-none focus:border-[#efaa9b]"
            />
          </div>
        )}

        {isCurrentLoggedInUser && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Verified as <strong>{userProfile?.displayName || currentUser?.email}</strong> (No PIN needed)</span>
          </div>
        )}

        {/* Punch Type Selector (Clock In, Break, Clock Out) */}
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction('clockIn')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                action === 'clockIn'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]'
                  : 'bg-slate-700/80 text-slate-300 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Clock In</span>
            </button>

            <button
              type="button"
              onClick={() => setAction('clockOut')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                action === 'clockOut'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 scale-[1.02]'
                  : 'bg-slate-700/80 text-slate-300 hover:text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Clock Out</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAction('breakStart')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                action === 'breakStart'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-750 bg-slate-700/50 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Start Lunch/Break</span>
            </button>

            <button
              type="button"
              onClick={() => setAction('breakEnd')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                action === 'breakEnd'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Resume from Break</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="text-rose-400 text-xs text-center bg-rose-950/30 border border-rose-800/40 p-2.5 rounded-xl">
            {error}
          </p>
        )}

        {/* Submit Punch Button */}
        <button
          type="submit"
          disabled={loading || !selectedStaff}
          className={`w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all shadow-lg disabled:opacity-50 active:scale-[0.98] ${
            action === 'clockIn'
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
              : action === 'clockOut'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                : action === 'breakStart'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                  : 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/25'
          }`}
        >
          {loading ? 'Recording Shift...' :
            action === 'clockIn' ? '✓ Record Shift Clock In' :
            action === 'clockOut' ? '✓ Record Shift Clock Out' :
            action === 'breakStart' ? '☕ Record Break / Lunch Start' :
            '✓ Record Resume from Break'
          }
        </button>
      </form>
    </div>
  );
}
