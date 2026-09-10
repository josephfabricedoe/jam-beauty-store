import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../contexts/AppContext';
import { getDefaultModuleForRole } from '../../utils/rbac';
import { 
  Lock, 
  Unlock, 
  Delete, 
  AlertCircle, 
  CheckCircle2, 
  LogOut, 
  Clock, 
  Sparkles, 
  Truck, 
  ShoppingCart, 
  UserCheck 
} from 'lucide-react';

export default function TerminalPinModal({ isOpen, onClose }) {
  const { unlockTerminalStaff, signOut } = useAuth();
  const { setActiveModule } = useApp();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null);

  // Keyboard number listener for physical desktop keyboards
  useEffect(() => {
    if (!isOpen || welcomeData) return;

    const handleKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, welcomeData]);

  const handleDigit = (digit) => {
    if (pin.length >= 4 || verifying || welcomeData) return;
    setError('');
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      verifyAndLogin(newPin);
    }
  };

  const handleBackspace = () => {
    if (verifying || welcomeData) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (verifying || welcomeData) return;
    setError('');
    setPin('');
  };

  const verifyAndLogin = async (enteredPin) => {
    setVerifying(true);
    setError('');

    try {
      // Query users collection for matching PIN
      const snap = await getDocs(collection(db, 'users'));
      const activeStaffList = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.active !== false);

      const staff = activeStaffList.find(u => String(u.pin || '').trim() === enteredPin);

      if (!staff) {
        setError('Incorrect PIN. Please contact Store Manager.');
        setPin('');
        setVerifying(false);
        return;
      }

      // Check attendance today & auto clock-in
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let clockedInNotice = '';
      try {
        const attQuery = query(
          collection(db, 'attendance'),
          where('staffId', '==', staff.id),
          where('timestamp', '>=', todayStart),
          orderBy('timestamp', 'desc')
        );
        const attSnap = await getDocs(attQuery);
        const latestPunch = attSnap.docs[0]?.data();

        // If no punch today, or last punch was clockOut: auto-punch clockIn!
        if (!latestPunch || latestPunch.action === 'clockOut') {
          await addDoc(collection(db, 'attendance'), {
            staffId: staff.id,
            staffName: staff.displayName || staff.email,
            role: staff.role || 'cashier',
            action: 'clockIn',
            timestamp: serverTimestamp(),
            date: todayStr,
            time: timeStr,
            hourlyRate: Number(staff.hourlyRate) || 0,
            shiftSchedule: staff.shiftSchedule || 'Full Day',
            deviceType: 'terminal-pin-kiosk',
            autoClockedIn: true,
          });
          clockedInNotice = `Clocked in at ${timeStr}`;
        } else {
          clockedInNotice = `Already on shift (last punch: ${latestPunch.time || timeStr})`;
        }
      } catch (attErr) {
        console.warn('Auto attendance notice:', attErr);
        clockedInNotice = `Shift Active (${timeStr})`;
      }

      // Show warm welcome card with role
      setWelcomeData({
        name: staff.displayName || staff.email,
        role: staff.role || 'cashier',
        clockNotice: clockedInNotice,
      });

      // Unlock active session and route to allowed workspace
      setTimeout(() => {
        unlockTerminalStaff(staff);
        setActiveModule(getDefaultModuleForRole(staff.role));
        if (onClose) onClose();
      }, 1300);

    } catch (err) {
      console.error('PIN verification failed:', err);
      setError('Connection error verifying PIN. Try again.');
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
        
        {/* Glowing aura */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#efaa9b]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {welcomeData ? (
          /* Success Screen on PIN unlock */
          <div className="space-y-4 py-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/50 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">{welcomeData.name}</h3>
              <p className="text-xs uppercase tracking-wider font-bold text-[#efaa9b] mt-0.5">
                {welcomeData.role === 'delivery' ? '🚚 Delivery Dispatch' : welcomeData.role === 'manager' ? '👔 Store Manager' : '💳 Store Cashier'}
              </p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-2.5 inline-flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>{welcomeData.clockNotice}</span>
            </div>
            <p className="text-[11px] text-slate-400">Opening workspace...</p>
          </div>
        ) : (
          /* Standard PIN Pad Screen */
          <>
            <div className="mb-4">
              <img
                src="/jam-logo-blush.jpg"
                alt="JAM Beauty"
                className="w-14 h-14 rounded-full object-cover border-2 border-[#efaa9b]/60 mx-auto shadow-lg"
              />
              <h2 className="text-base font-extrabold text-white tracking-wide mt-2">
                JAM BEAUTY STORE TERMINAL
              </h2>
              <p className="text-xs text-[#efaa9b] font-medium mt-0.5">
                Enter your 4-digit secret PIN to unlock
              </p>
            </div>

            {/* 4-digit masked circles */}
            <div className="flex items-center justify-center gap-3 my-3">
              {[0, 1, 2, 3].map(idx => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border transition-all duration-150 ${
                    pin.length > idx
                      ? 'bg-[#efaa9b] border-[#efaa9b] scale-110 shadow-md shadow-[#efaa9b]/50'
                      : 'border-slate-600 bg-slate-800/50'
                  }`}
                />
              ))}
            </div>

            {/* Error message or status */}
            <div className="h-6 mb-2 flex items-center justify-center">
              {error ? (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium animate-bounce">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : verifying ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
                  <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying PIN & Clocking in...</span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-500">Auto clock-in kicks in upon PIN entry</span>
              )}
            </div>

            {/* Numeric Keypad Grid (3x4) */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mx-auto mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(String(num))}
                  disabled={verifying}
                  className="h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 active:bg-[#efaa9b] active:text-[#45150b] border border-slate-700 text-white font-bold text-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                disabled={verifying || pin.length === 0}
                className="h-14 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white text-xs font-bold uppercase transition-all active:scale-95 disabled:opacity-40"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => handleDigit('0')}
                disabled={verifying}
                className="h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 active:bg-[#efaa9b] active:text-[#45150b] border border-slate-700 text-white font-bold text-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                disabled={verifying || pin.length === 0}
                aria-label="Backspace"
                className="h-14 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Bottom option to Sign Out of store terminal */}
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors pt-2 border-t border-slate-800 w-full justify-center"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Store Account (Jambeautyliberia@gmail.com)</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
