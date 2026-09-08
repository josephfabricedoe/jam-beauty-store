import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { downloadCSV } from '../../utils/exportCsv';
import { useApp } from '../../contexts/AppContext';
import AttendanceLogModal from './AttendanceLogModal';
import {
  Clock, Download, PlusCircle, Edit2, Users, CheckCircle2,
  AlertTriangle, Calendar, UserCheck, Search, Filter, DollarSign, Calculator
} from 'lucide-react';

export function getPayrollCycleDates(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let startYear = year, startMonth, endYear = year, endMonth;

  if (day <= 25) {
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = year - 1;
    }
    endMonth = month;
  } else {
    startMonth = month;
    endMonth = month + 1;
    if (endMonth > 11) {
      endMonth = 0;
      endYear = year + 1;
    }
  }

  const startDate = new Date(startYear, startMonth, 26, 0, 0, 0, 0);
  const endDate = new Date(endYear, endMonth, 25, 23, 59, 59, 999);
  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const cycleTitle = `${startLabel} – ${endLabel}`;

  return { startDate, endDate, cycleTitle };
}

export default function TimesheetAdmin({ staffList = [] }) {
  const { exchangeRate } = useApp();
  const [records, setRecords] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('payroll'); // 'payroll' | 'today' | 'week' | 'month' | 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const payrollCycle = getPayrollCycleDates();

  // Subscribe to sales for 1% commission calculation (sales >= $425/day)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sales'), snap => {
      setSalesRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    let q;
    const now = new Date();

    if (period === 'payroll') {
      q = query(
        collection(db, 'attendance'),
        where('timestamp', '>=', Timestamp.fromDate(payrollCycle.startDate)),
        where('timestamp', '<=', Timestamp.fromDate(payrollCycle.endDate)),
        orderBy('timestamp', 'desc')
      );
    } else if (period === 'today') {
      const from = new Date(now); from.setHours(0, 0, 0, 0);
      q = query(collection(db, 'attendance'), where('timestamp', '>=', Timestamp.fromDate(from)), orderBy('timestamp', 'desc'));
    } else if (period === 'week') {
      const from = new Date(now); from.setDate(now.getDate() - now.getDay()); from.setHours(0, 0, 0, 0);
      q = query(collection(db, 'attendance'), where('timestamp', '>=', Timestamp.fromDate(from)), orderBy('timestamp', 'desc'));
    } else if (period === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      q = query(collection(db, 'attendance'), where('timestamp', '>=', Timestamp.fromDate(from)), orderBy('timestamp', 'desc'));
    } else {
      q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'));
    }

    return onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [period]);

  // Group raw logs by staff and date into cohesive shifts
  const groupedShifts = records.reduce((acc, r) => {
    const dateObj = r.timestamp?.toDate ? r.timestamp.toDate() : new Date();
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const key = `${r.staffId}_${dateStr}`;

    if (!acc[key]) {
      acc[key] = {
        key,
        id: r.id,
        staffId: r.staffId,
        staffName: r.staffName || 'Staff',
        dateStr,
        rawDate: dateObj,
        clockInRecord: null,
        clockOutRecord: null,
        clockIn: null,
        clockOut: null,
        notes: [],
        adjusted: false,
      };
    }

    if (r.action === 'clockIn' && !acc[key].clockIn) {
      acc[key].clockIn = dateObj;
      acc[key].clockInRecord = r;
    }
    if (r.action === 'clockOut' && !acc[key].clockOut) {
      acc[key].clockOut = dateObj;
      acc[key].clockOutRecord = r;
    }
    if (r.note) acc[key].notes.push(r.note);
    if (r.adjustedByAdmin) acc[key].adjusted = true;

    return acc;
  }, {});

  const shiftList = Object.values(groupedShifts).sort((a, b) => b.rawDate - a.rawDate);

  // Live status: Who is working right now?
  const liveStatusByStaff = staffList.map(staff => {
    // Find the very latest punch for this staff
    const staffLogs = records
      .filter(r => r.staffId === staff.id)
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    const latest = staffLogs[0];
    const isClockedIn = latest && (latest.action === 'clockIn' || latest.action === 'breakEnd');
    const isOnBreak = latest && latest.action === 'breakStart';
    const clockInTime = isClockedIn && latest.timestamp?.toDate ? latest.timestamp.toDate() : null;

    let durationStr = '';
    if (clockInTime) {
      const diffMs = Date.now() - clockInTime.getTime();
      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      durationStr = `${hrs}h ${mins}m`;
    }

    return {
      staff,
      isClockedIn,
      isOnBreak,
      clockInTime,
      durationStr,
      latestRecord: latest,
    };
  });

  const currentlyWorkingCount = liveStatusByStaff.filter(s => s.isClockedIn).length;

  // Filtered shift rows by search
  const filteredShifts = shiftList.filter(s => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return s.staffName.toLowerCase().includes(q) || s.dateStr.toLowerCase().includes(q);
  });

  const calcShiftHours = (shift) => {
    if (!shift.clockIn || !shift.clockOut) return null;
    let totalMs = shift.clockOut.getTime() - shift.clockIn.getTime();
    if (shift.breakStart && shift.breakEnd) {
      const breakMs = Math.max(0, shift.breakEnd.getTime() - shift.breakStart.getTime());
      totalMs -= breakMs;
    }
    const diffHours = Math.max(0, totalMs) / 3600000;
    return Math.max(0, diffHours).toFixed(1);
  };

  const isLateArrival = (shift) => {
    if (!shift.clockIn) return false;
    // Late if arriving after 9:15 AM
    const h = shift.clockIn.getHours();
    const m = shift.clockIn.getMinutes();
    return h > 9 || (h === 9 && m > 15);
  };

  // Automated Monthly Payroll Calculation (26th of prev month to 25th of current month)
  const payrollSummary = staffList.map(staff => {
    const staffShifts = shiftList.filter(s => s.staffId === staff.id);
    let totalHours = 0;
    let overtimeHours = 0;
    let regularHours = 0;

    staffShifts.forEach(s => {
      const hrs = calcShiftHours(s);
      if (hrs) {
        const num = parseFloat(hrs);
        totalHours += num;
        if (num > 8) {
          overtimeHours += (num - 8);
          regularHours += 8;
        } else {
          regularHours += num;
        }
      }
    });

    // 1% Commission for staff when daily sales >= $425 USD
    const staffSalesInCycle = salesRecords.filter(sale => {
      const isCashier = (sale.cashierId && sale.cashierId === staff.id) ||
                        (sale.cashierName && (
                          sale.cashierName.toLowerCase() === (staff.displayName || '').toLowerCase() ||
                          sale.cashierName.toLowerCase() === (staff.email || '').toLowerCase()
                        ));
      if (!isCashier) return false;
      const sDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : null;
      if (!sDate) return false;
      return sDate >= payrollCycle.startDate && sDate <= payrollCycle.endDate;
    });

    // Group sales by calendar day (YYYY-MM-DD)
    const salesByDay = staffSalesInCycle.reduce((acc, sale) => {
      const sDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date();
      const dayKey = sDate.toISOString().slice(0, 10);
      acc[dayKey] = (acc[dayKey] || 0) + (Number(sale.total) || 0);
      return acc;
    }, {});

    let commissionUSD = 0;
    let qualifyingDaysCount = 0;
    let totalQualifyingSales = 0;

    Object.entries(salesByDay).forEach(([, dayTotal]) => {
      if (dayTotal >= 425) {
        qualifyingDaysCount += 1;
        totalQualifyingSales += dayTotal;
        commissionUSD += dayTotal * 0.01; // 1% commission on days >= $425
      }
    });

    const rate = Number(staff.hourlyRate || 0);
    const regularPay = regularHours * rate;
    const overtimePay = overtimeHours * (rate * 1.5);
    const totalUSD = regularPay + overtimePay + commissionUSD;
    const totalLRD = totalUSD * (exchangeRate || 197);

    return {
      staff,
      staffName: staff.displayName || staff.email || 'Staff',
      role: staff.role || 'staff',
      shiftCount: staffShifts.length,
      rate,
      regularHours: regularHours.toFixed(1),
      overtimeHours: overtimeHours.toFixed(1),
      totalHours: totalHours.toFixed(1),
      regularPay: regularPay.toFixed(2),
      overtimePay: overtimePay.toFixed(2),
      qualifyingDaysCount,
      totalQualifyingSales: totalQualifyingSales.toFixed(2),
      commissionUSD: commissionUSD.toFixed(2),
      commissionLRD: (commissionUSD * (exchangeRate || 197)).toFixed(0),
      totalUSD: totalUSD.toFixed(2),
      totalLRD: totalLRD.toFixed(0),
    };
  });

  const totalPayrollUSD = payrollSummary.reduce((acc, p) => acc + parseFloat(p.totalUSD), 0);
  const totalPayrollLRD = payrollSummary.reduce((acc, p) => acc + parseFloat(p.totalLRD), 0);
  const totalCommissionUSD = payrollSummary.reduce((acc, p) => acc + parseFloat(p.commissionUSD), 0);

  const handleExportPayrollCSV = () => {
    const data = payrollSummary.map(p => ({
      staffName: p.staffName,
      role: p.role,
      hourlyRate: `$${p.rate.toFixed(2)}/hr`,
      shiftsWorked: p.shiftCount,
      regularHours: p.regularHours,
      overtimeHours: p.overtimeHours,
      totalHours: p.totalHours,
      regularPayUSD: `$${p.regularPay}`,
      overtimePayUSD: `$${p.overtimePay}`,
      qualifyingDays: `${p.qualifyingDaysCount} days (Daily Sales >= $425)`,
      commissionEarnedUSD: `$${p.commissionUSD}`,
      grossSalaryUSD: `$${p.totalUSD}`,
      grossSalaryLRD: `L$${Number(p.totalLRD).toLocaleString()}`,
    }));

    const headers = {
      staffName: 'Staff Member',
      role: 'Role',
      hourlyRate: 'Hourly Pay Rate ($/hr)',
      shiftsWorked: 'Shifts Worked',
      regularHours: 'Regular Hours',
      overtimeHours: 'Overtime Hours (>8h)',
      totalHours: 'Total Hours Worked',
      regularPayUSD: 'Base Pay (USD)',
      overtimePayUSD: 'Overtime Pay (USD)',
      qualifyingDays: 'Qualifying Commission Days (Sales >= $425)',
      commissionEarnedUSD: '1% Sales Commission (USD)',
      grossSalaryUSD: 'Total Gross Salary (USD)',
      grossSalaryLRD: `Total Gross Salary (LRD @ ${exchangeRate})`,
    };

    downloadCSV(`jam_beauty_monthly_payroll_${payrollCycle.cycleTitle.replace(/\s+/g, '_')}.csv`, data, headers);
  };

  const handleExportCSV = () => {
    const data = filteredShifts.map(s => {
      const hours = calcShiftHours(s);
      return {
        staffName: s.staffName,
        date: s.dateStr,
        clockIn: s.clockIn ? s.clockIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'MISSING',
        clockOut: s.clockOut ? s.clockOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : (s.clockIn ? 'ON SHIFT' : 'MISSING'),
        totalHours: hours || (s.clockIn && !s.clockOut ? 'In Progress' : '0.0'),
        lateArrival: isLateArrival(s) ? 'YES' : 'NO',
        overtime: hours && parseFloat(hours) > 8 ? (parseFloat(hours) - 8).toFixed(1) : '0.0',
        adjustedByAdmin: s.adjusted ? 'YES' : 'NO',
        notes: s.notes.join('; '),
      };
    });

    const headers = {
      staffName: 'Staff Name',
      date: 'Date',
      clockIn: 'Clock In Time',
      clockOut: 'Clock Out Time',
      totalHours: 'Total Hours Worked',
      lateArrival: 'Late Arrival (>9:15 AM)',
      overtime: 'Overtime Hours (>8 hrs)',
      adjustedByAdmin: 'Admin Adjusted',
      notes: 'Notes / Remarks',
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jam_beauty_staff_attendance_${todayStr}.csv`, data, headers);
  };

  return (
    <div className="space-y-4">
      {/* Live "Who's Working Right Now?" Monitor */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h3 className="text-sm font-bold text-white">Live Store Shift Monitor</h3>
          </div>
          <span className="text-xs bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded-full font-semibold">
            {currentlyWorkingCount} of {staffList.length} staff on shift
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {liveStatusByStaff.map(({ staff, isClockedIn, isOnBreak, clockInTime, durationStr }) => (
            <div
              key={staff.id}
              className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                isClockedIn
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-white'
                  : isOnBreak
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900/40 border-slate-700/60 text-slate-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isClockedIn ? 'bg-emerald-500 text-black' : isOnBreak ? 'bg-amber-400 text-black' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {(staff.displayName || staff.email || 'S')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-xs truncate">{staff.displayName || staff.email}</p>
                <p className="text-[11px] text-slate-400">
                  {isClockedIn
                    ? `In: ${clockInTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${durationStr})`
                    : isOnBreak
                      ? 'On Break / Lunch'
                      : 'Off duty'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Controls & Date Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/40 border border-slate-700/60 p-3 rounded-2xl">
        {/* Date Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'payroll', label: `💰 Monthly Payroll (${payrollCycle.cycleTitle})` },
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'Calendar Month' },
            { id: 'all', label: 'All Records' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                period === p.id
                  ? 'bg-[#efaa9b] text-[#45150b] font-bold shadow-sm'
                  : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Action buttons: Add Manual Log & Export CSV */}
        <div className="flex items-center gap-2">
          {period === 'payroll' ? (
            <button
              type="button"
              onClick={handleExportPayrollCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Payroll (CSV)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#efaa9b]" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditRecord(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-bold transition-colors shadow-md shadow-[#efaa9b]/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Manual Entry / Adjust</span>
          </button>
        </div>
      </div>

      {/* Monthly Payroll Summary Card when 'payroll' period is selected */}
      {period === 'payroll' && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/90 border border-[#efaa9b]/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#efaa9b]/20 flex items-center justify-center text-[#efaa9b]">
                  <Calculator className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Monthly Store Payroll Calculation</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pay Cycle: <strong>{payrollCycle.cycleTitle}</strong> (Paid on the 25th of every month)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-slate-900/60 border border-[#efaa9b]/30 px-3.5 py-2 rounded-xl text-right">
                <p className="text-[10px] text-[#efaa9b] uppercase font-bold tracking-wider">1% Commission</p>
                <p className="text-base font-extrabold text-[#efaa9b]">
                  +${totalCommissionUSD.toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 px-4 py-2 rounded-xl text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Gross Payroll</p>
                <p className="text-base sm:text-lg font-black text-emerald-400">
                  ${totalPayrollUSD.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-400">/ L${totalPayrollLRD.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Payroll Breakdown Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-700/80">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-700">
                  <th className="text-left px-3 py-2.5">Staff Employee</th>
                  <th className="text-center px-3 py-2.5">Hourly Rate</th>
                  <th className="text-center px-3 py-2.5">Shifts</th>
                  <th className="text-right px-3 py-2.5">Regular Hrs</th>
                  <th className="text-right px-3 py-2.5">Overtime Hrs</th>
                  <th className="text-right px-3 py-2.5">Total Hrs</th>
                  <th className="text-right px-3 py-2.5">Base Pay</th>
                  <th className="text-right px-3 py-2.5">1% Commission (&ge;$425/day)</th>
                  <th className="text-right px-3 py-2.5">Gross Pay (USD)</th>
                  <th className="text-right px-3 py-2.5">Gross Pay (LRD)</th>
                </tr>
              </thead>
              <tbody>
                {payrollSummary.map((p, idx) => (
                  <tr key={idx} className="border-t border-slate-800 hover:bg-slate-800/60 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-white">
                      <div>{p.staffName}</div>
                      <span className="text-[10px] text-slate-500 capitalize">{p.role}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-emerald-400">
                      {p.rate > 0 ? `$${p.rate.toFixed(2)}/hr` : (
                        <span className="text-slate-500 italic">Rate not set</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-300 font-medium">
                      {p.shiftCount} shifts
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                      {p.regularHours} hrs
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-400">
                      {p.overtimeHours > 0 ? `+${p.overtimeHours} hrs` : '0.0 hrs'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-white">
                      {p.totalHours} hrs
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                      ${(parseFloat(p.regularPay) + parseFloat(p.overtimePay)).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {parseFloat(p.commissionUSD) > 0 ? (
                        <div>
                          <span className="text-emerald-400 font-bold">+${p.commissionUSD}</span>
                          <span className="text-[10px] text-slate-400 block">{p.qualifyingDaysCount} day{p.qualifyingDaysCount !== 1 ? 's' : ''} &ge; $425</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">$0.00</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-300">
                      ${p.totalUSD}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-300 font-mono">
                      L${Number(p.totalLRD).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timesheet Shift Records Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>Staff Attendance Ledger</span>
            <span className="text-xs text-slate-400 font-normal">({filteredShifts.length} shifts)</span>
          </h3>

          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filter by staff name..."
              className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#efaa9b]"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500 text-xs py-8 text-center">Loading attendance timesheets...</p>
        ) : filteredShifts.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <th className="text-left px-3 py-2.5">Staff Member</th>
                  <th className="text-left px-3 py-2.5">Date</th>
                  <th className="text-left px-3 py-2.5">Clock In</th>
                  <th className="text-left px-3 py-2.5">Clock Out</th>
                  <th className="text-right px-3 py-2.5">Total Hours</th>
                  <th className="text-center px-3 py-2.5">Punctuality</th>
                  <th className="text-center px-3 py-2.5">Admin Adjust</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((shift, i) => {
                  const hours = calcShiftHours(shift);
                  const late = isLateArrival(shift);

                  return (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/60 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{shift.staffName}</span>
                          {shift.adjusted && (
                            <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-700/40 px-1.5 py-0.2 rounded">
                              Adjusted
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-slate-300">{shift.dateStr}</td>

                      <td className="px-3 py-2.5 text-emerald-400 font-mono">
                        {shift.clockIn ? shift.clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                          <span className="text-slate-600 italic">No Clock In</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-rose-400 font-mono">
                        {shift.clockOut ? shift.clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                          shift.clockIn ? (
                            <span className="text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded text-[11px] font-semibold animate-pulse">
                              On Shift Now
                            </span>
                          ) : (
                            <span className="text-slate-600 italic">No Clock Out</span>
                          )
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right font-bold text-white">
                        {hours ? `${hours} hrs` : shift.clockIn ? '—' : '0.0 hrs'}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {late ? (
                          <span className="text-[11px] bg-amber-900/40 text-amber-300 border border-amber-700/50 px-1.5 py-0.5 rounded font-medium">
                            Late Arrival
                          </span>
                        ) : shift.clockIn ? (
                          <span className="text-[11px] bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded font-medium">
                            On Time ✓
                          </span>
                        ) : '—'}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            // Edit clock in or clock out record
                            const targetRec = shift.clockInRecord || shift.clockOutRecord;
                            setEditRecord(targetRec);
                            setModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-[#efaa9b]" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No attendance records found for this period.</p>
            <p className="text-xs mt-1">Staff can clock in using the Clock In tab or you can add manual logs.</p>
          </div>
        )}
      </div>

      {/* Manual Add / Edit Attendance Modal */}
      <AttendanceLogModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditRecord(null);
        }}
        editRecord={editRecord}
        staffList={staffList}
      />
    </div>
  );
}
