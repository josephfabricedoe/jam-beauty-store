import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../contexts/AppContext';
import { useCurrency } from '../../hooks/useCurrency';
import Modal from '../shared/Modal';
import { Printer, CheckCircle, AlertTriangle, DollarSign, Calculator, FileText, ArrowRight, Bluetooth } from 'lucide-react';
import { printToBluetoothThermalPrinter, buildZReportEscPos } from '../../utils/bluetoothPrinter';

export default function ShiftHandoverModal({ isOpen, onClose, sales = [], expenses = [] }) {
  const { currentUser } = useAuth();
  const { exchangeRate, storeSettings } = useApp();
  const { format } = useCurrency();
  const printRef = useRef(null);

  const [openingFloatUSD, setOpeningFloatUSD] = useState('0');
  const [countedCashUSD, setCountedCashUSD] = useState('');
  const [countedCashLRD, setCountedCashLRD] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Compute shift financial aggregates
  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Filter sales for today
  const todaySales = sales.filter(s => {
    const d = s.timestamp?.toDate ? s.timestamp.toDate() : new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) === todayStr;
  });

  const todayExpenses = expenses.filter(e => {
    const d = e.timestamp?.toDate ? e.timestamp.toDate() : new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) === todayStr;
  });

  const totalGrossSales = todaySales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const cashSales = todaySales.filter(s => (s.paymentMethod || '').toLowerCase() === 'cash')
                              .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const momoSales = todaySales.filter(s => (s.paymentMethod || '').toLowerCase() === 'momo')
                              .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const cardSales = todaySales.filter(s => (s.paymentMethod || '').toLowerCase() === 'card')
                              .reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const creditSales = todaySales.filter(s => (s.paymentMethod || '').toLowerCase() === 'store credit' || s.isStoreCredit)
                                .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  const drawerExpensesUSD = todayExpenses.reduce((sum, e) => sum + (Number(e.amountUSD || e.amount) || 0), 0);

  const floatUSD = parseFloat(openingFloatUSD) || 0;
  const expectedCashUSD = floatUSD + cashSales - drawerExpensesUSD;

  // Actual physical USD cash counted + LRD converted to USD
  const actualUSD = parseFloat(countedCashUSD) || 0;
  const actualLRD = parseFloat(countedCashLRD) || 0;
  const lrdInUSD = exchangeRate > 0 ? actualLRD / exchangeRate : 0;
  const totalCountedUSD = actualUSD + lrdInUSD;

  const varianceUSD = totalCountedUSD - expectedCashUSD;
  const isBalanced = Math.abs(varianceUSD) < 0.05;
  const isOver = varianceUSD > 0.05;
  const isShort = varianceUSD < -0.05;

  const [btPrinting, setBtPrinting] = useState(false);

  const handlePrint = () => {
    const root = document.getElementById('receipt-print-root');
    if (root && printRef.current) {
      root.innerHTML = printRef.current.innerHTML;
      root.style.display = 'block';
      window.print();
      setTimeout(() => {
        root.innerHTML = '';
        root.style.display = 'none';
      }, 1000);
    }
  };

  const handleBluetoothPrint = async () => {
    setBtPrinting(true);
    try {
      const escBytes = buildZReportEscPos(
        {
          cashierName: currentUser?.displayName || currentUser?.email || 'Staff',
          date: todayStr,
          totalSales: todayGrossUSD,
          salesCount: todaySales.length,
          cashSales: totalCashUSD,
          momoSales: totalMoMoUSD,
          cardSales: totalCardUSD,
          openingFloat: floatUSD,
          countedCash: totalCountedUSD,
          expectedCash: expectedCashUSD,
          variance: varianceUSD,
          status: isBalanced ? 'BALANCED' : isOver ? 'OVER' : 'SHORT',
        },
        storeSettings
      );
      await printToBluetoothThermalPrinter(escBytes);
      alert('Z-Report successfully sent to 58mm Bluetooth printer!');
    } catch (err) {
      console.error('Bluetooth Z-report print error:', err);
      alert(err.message || 'Could not connect to Bluetooth printer.');
    } finally {
      setBtPrinting(false);
    }
  };

  const handleSaveHandover = async () => {
    if (!countedCashUSD && !countedCashLRD) {
      alert('Please enter the physical cash counted in the drawer (USD or LRD).');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'shiftHandovers'), {
        date: todayStr,
        timestamp: serverTimestamp(),
        cashierId: currentUser?.uid || 'staff',
        cashierName: currentUser?.displayName || currentUser?.email || 'Cashier',
        openingFloatUSD: floatUSD,
        totalGrossSales,
        cashSales,
        momoSales,
        cardSales,
        creditSales,
        drawerExpensesUSD,
        expectedCashUSD,
        countedCashUSD: actualUSD,
        countedCashLRD: actualLRD,
        totalCountedUSD,
        varianceUSD,
        exchangeRate,
        notes,
        status: isBalanced ? 'balanced' : isOver ? 'over' : 'short',
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1500);
    } catch (e) {
      alert('Failed to save shift handover: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Shift Handover & Z-Report Drawer Count"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={btPrinting}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Bluetooth className="w-4 h-4" />
              <span>{btPrinting ? 'Printing 58mm...' : 'Print 58mm (Bluetooth)'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handleSaveHandover}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-black transition-colors shadow-lg shadow-[#efaa9b]/25 disabled:opacity-50"
            >
              {saving ? (
                <span>Saving...</span>
              ) : savedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Handover Saved!</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Finalize & Save Z-Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Top Shift Header */}
        <div className="bg-slate-900/70 border border-slate-700/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase font-bold text-[#efaa9b] tracking-wider">Active Register</p>
            <h4 className="text-sm font-bold text-white mt-0.5">
              Shift Closing: {todayStr}
            </h4>
            <p className="text-xs text-slate-400">
              Cashier: <strong className="text-slate-200">{currentUser?.displayName || currentUser?.email || 'Store Cashier'}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-lg">
              Rate: 1 USD = {exchangeRate} LRD
            </span>
          </div>
        </div>

        {/* Expected Breakdown Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl">
            <p className="text-slate-400 text-[11px]">Total Shift Sales</p>
            <p className="text-sm font-bold text-white mt-0.5">${totalGrossSales.toFixed(2)}</p>
            <p className="text-[10px] text-slate-500">{todaySales.length} transactions</p>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl">
            <p className="text-emerald-400 text-[11px] font-semibold">Cash in Drawer</p>
            <p className="text-sm font-bold text-emerald-300 mt-0.5">${cashSales.toFixed(2)}</p>
            <p className="text-[10px] text-slate-500">Physical paper cash</p>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl">
            <p className="text-blue-400 text-[11px] font-semibold">Mobile Money (MoMo)</p>
            <p className="text-sm font-bold text-blue-300 mt-0.5">${momoSales.toFixed(2)}</p>
            <p className="text-[10px] text-slate-500">Lonestar / Orange</p>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-2.5 rounded-xl">
            <p className="text-amber-400 text-[11px] font-semibold">Store Credit / Other</p>
            <p className="text-sm font-bold text-amber-300 mt-0.5">${(creditSales + cardSales).toFixed(2)}</p>
            <p className="text-[10px] text-slate-500">Salons on Account</p>
          </div>
        </div>

        {/* Cash Drawer Counting Inputs */}
        <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-[#efaa9b]" />
            <span>Physical Drawer Cash Count</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Opening Float (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={openingFloatUSD}
                onChange={e => setOpeningFloatUSD(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#efaa9b]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Counted USD Cash ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={countedCashUSD}
                onChange={e => setCountedCashUSD(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#efaa9b]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Counted LRD Cash (L$)
              </label>
              <input
                type="number"
                step="1"
                value={countedCashLRD}
                onChange={e => setCountedCashLRD(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#efaa9b]"
              />
            </div>
          </div>

          {drawerExpensesUSD > 0 && (
            <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex justify-between">
              <span>Shift Drawer Payouts / Expenses:</span>
              <span className="font-bold font-mono">-${drawerExpensesUSD.toFixed(2)}</span>
            </div>
          )}

          {/* Reconciliation Result Banner */}
          <div className="pt-2 border-t border-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <span className="text-[11px] text-slate-400 block">Expected Cash in Drawer:</span>
                <span className="text-base font-bold text-white font-mono">
                  ${expectedCashUSD.toFixed(2)}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">Total Counted (USD Eqv):</span>
                <span className="text-base font-bold text-white font-mono">
                  ${totalCountedUSD.toFixed(2)}
                </span>
                {actualLRD > 0 && (
                  <span className="text-[10px] text-slate-400 block">
                    (Includes L${actualLRD.toLocaleString()})
                  </span>
                )}
              </div>

              <div className="sm:text-right">
                <span className="text-[11px] text-slate-400 block">Drawer Variance:</span>
                <span
                  className={`text-base font-black font-mono inline-flex items-center gap-1 ${
                    isBalanced
                      ? 'text-emerald-400'
                      : isOver
                      ? 'text-blue-400'
                      : 'text-red-400'
                  }`}
                >
                  {isBalanced ? (
                    'BALANCED ($0.00)'
                  ) : isOver ? (
                    `+$${varianceUSD.toFixed(2)} (OVER)`
                  ) : (
                    `-$${Math.abs(varianceUSD).toFixed(2)} (SHORT)`
                  )}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-400 block mb-1">
              Shift Handover Notes / Drawer Explanations
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Handed over register to Sarah; minor change discrepancy due to 10 LRD bill shortage"
              className="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#efaa9b]"
            />
          </div>
        </div>

        {/* Printable Z-Report Format (Hidden until print) */}
        <div className="hidden">
          <div ref={printRef} className="receipt-print font-mono text-xs bg-white text-black p-4 w-[58mm] sm:w-[80mm] mx-auto">
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <h2 className="font-extrabold text-sm uppercase">{storeSettings?.storeName || 'JAM BEAUTY STORE'}</h2>
              <p className="text-[10px]">MONROVIA, LIBERIA</p>
              <p className="text-[10px] font-bold mt-1">*** OFFICIAL Z-REPORT ***</p>
              <p className="text-[9px]">END-OF-SHIFT RECONCILIATION</p>
            </div>

            <div className="py-2 border-b border-dashed border-gray-300 text-[10px] space-y-0.5">
              <div className="flex justify-between"><span>Date:</span><span>{todayStr}</span></div>
              <div className="flex justify-between"><span>Time:</span><span>{new Date().toLocaleTimeString()}</span></div>
              <div className="flex justify-between"><span>Cashier:</span><span>{currentUser?.displayName || 'Cashier'}</span></div>
              <div className="flex justify-between"><span>Rate:</span><span>1 USD = {exchangeRate} LRD</span></div>
            </div>

            <div className="py-2 border-b border-dashed border-gray-300 text-[10px] space-y-1">
              <div className="font-bold">SALES BREAKDOWN</div>
              <div className="flex justify-between"><span>Cash Sales:</span><span>${cashSales.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Mobile Money:</span><span>${momoSales.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Card Sales:</span><span>${cardSales.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Store Credit:</span><span>${creditSales.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold pt-1 border-t border-gray-200">
                <span>GROSS TOTAL:</span><span>${totalGrossSales.toFixed(2)}</span>
              </div>
            </div>

            <div className="py-2 border-b border-dashed border-gray-300 text-[10px] space-y-1">
              <div className="font-bold">DRAWER RECONCILIATION</div>
              <div className="flex justify-between"><span>Opening Float:</span><span>${floatUSD.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>+ Cash Collected:</span><span>${cashSales.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>- Drawer Payouts:</span><span>-${drawerExpensesUSD.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold">
                <span>EXPECTED CASH:</span><span>${expectedCashUSD.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 my-1" />
              <div className="flex justify-between"><span>USD Counted:</span><span>${actualUSD.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>LRD Counted:</span><span>L${actualLRD.toLocaleString()}</span></div>
              <div className="flex justify-between font-bold">
                <span>TOTAL COUNTED:</span><span>${totalCountedUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-[11px] pt-1 border-t border-dashed border-gray-400">
                <span>VARIANCE:</span>
                <span>
                  {isBalanced ? '$0.00 (OK)' : isOver ? `+$${varianceUSD.toFixed(2)} OVER` : `-$${Math.abs(varianceUSD).toFixed(2)} SHORT`}
                </span>
              </div>
            </div>

            {notes && (
              <div className="py-2 border-b border-dashed border-gray-300 text-[9px]">
                <span className="font-bold">Notes: </span>{notes}
              </div>
            )}

            <div className="pt-4 text-[9px] text-center space-y-4">
              <div>
                <p>_____________________________</p>
                <p>Cashier Signature</p>
              </div>
              <div>
                <p>_____________________________</p>
                <p>Manager Verification</p>
              </div>
              <p className="text-[8px] text-gray-500">JAM Beauty Store POS System</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
