import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import DateFilterBar, {
  filterItemsByPeriod,
  stepPeriodDate,
  getPeriodFormattedLabel
} from './DateFilterBar';
import SummaryMetrics from './SummaryMetrics';
import SalesInflow from './SalesInflow';
import ExpenseForm from './ExpenseForm';
import CashReconciliation from './CashReconciliation';
import { SalesByDayChart, RevenueVsExpensesChart } from './SalesChart';
import PaymentPieChart from './PaymentPieChart';
import TopProducts from './TopProducts';
import SalesImport from './SalesImport';
import DetailedStoreReport from './DetailedStoreReport';
import Modal from '../shared/Modal';
import { 
  BarChart2, 
  List, 
  CreditCard, 
  Upload, 
  Download, 
  Sparkles,
  Camera,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Ship,
  Boxes,
  CheckCircle2
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportCsv';

const TABS = [
  { id: 'detailed', label: 'Store Deep Report', icon: Sparkles },
  { id: 'overview', label: 'Ledger & Inflows',  icon: List },
  { id: 'charts',   label: 'Visual Charts',     icon: BarChart2 },
  { id: 'expenses', label: 'Expenses & Restocks', icon: CreditCard },
  { id: 'import',   label: 'Import Sales',      icon: Upload },
];

export default function FinanceView() {
  // Unified single source of truth for time/date filtering across all tabs
  const [periodMode, setPeriodMode] = useState('month'); // default to 'month'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [rawSales, setRawSales] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);
  const [rawDeliveries, setRawDeliveries] = useState([]);
  const [activeTab, setActiveTab] = useState('detailed');

  // Expense sub-filter & Receipt Lightbox
  const [expenseSubFilter, setExpenseSubFilter] = useState('all'); // 'all' | 'restock' | 'overhead' | 'missing_receipt'
  const [inspectedReceipt, setInspectedReceipt] = useState(null);

  // Step backward or forward in time
  const stepDate = (offset) => {
    setSelectedDate(prev => stepPeriodDate(prev, periodMode, offset));
  };

  // Real-time Firestore Listeners with error protection
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'sales'), orderBy('timestamp', 'desc')),
      snap => setRawSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.warn('Sales listener notice:', err)
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'expenses'), orderBy('timestamp', 'desc')),
      snap => setRawExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.warn('Expenses listener notice:', err)
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'deliveries'), orderBy('timestamp', 'desc')),
      snap => setRawDeliveries(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.warn('Deliveries listener notice:', err)
    );
    return unsub;
  }, []);

  // Filter raw collections by the unified period (synchronizing all components)
  const sales = useMemo(() => {
    return filterItemsByPeriod(rawSales, periodMode, selectedDate, customFrom, customTo);
  }, [rawSales, periodMode, selectedDate, customFrom, customTo]);

  const expenses = useMemo(() => {
    return filterItemsByPeriod(rawExpenses, periodMode, selectedDate, customFrom, customTo);
  }, [rawExpenses, periodMode, selectedDate, customFrom, customTo]);

  const deliveries = useMemo(() => {
    return filterItemsByPeriod(rawDeliveries, periodMode, selectedDate, customFrom, customTo);
  }, [rawDeliveries, periodMode, selectedDate, customFrom, customTo]);

  const formattedPeriodLabel = useMemo(() => {
    return getPeriodFormattedLabel(periodMode, selectedDate, customFrom, customTo);
  }, [periodMode, selectedDate, customFrom, customTo]);

  // Exact Financial Calculations
  const posSalesTotal = sales.reduce((s, sale) => s + (sale.total || 0), 0);
  const deliveryIncome = deliveries
    .filter(d => d.paymentStatus === 'Paid' || d.cashConfirmed)
    .reduce((s, d) => s + (d.charge || 0), 0);
  const grossRevenue = posSalesTotal + deliveryIncome;
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Exact Physical Drawer Cash Calculations (Only Cash Drawer payouts affect register cash)
  const cashSales = sales
    .filter(s => (s.paymentMethod || 'Cash').toLowerCase() === 'cash')
    .reduce((s, sale) => s + (sale.total || 0), 0);

  const cashDeliveries = deliveries
    .filter(d => (d.paymentStatus === 'Paid' || d.cashConfirmed) && (d.paymentStatus === 'COD' || d.paymentStatus === 'Paid'))
    .reduce((s, d) => s + (d.charge || 0), 0);

  const drawerCashExpenses = expenses
    .filter(e => !e.paymentMethod || e.paymentMethod === 'cash_drawer' || e.paymentMethod === 'Cash')
    .reduce((s, e) => s + (e.amount || 0), 0);

  const electronicExpenses = expenses
    .filter(e => e.paymentMethod && e.paymentMethod !== 'cash_drawer' && e.paymentMethod !== 'Cash')
    .reduce((s, e) => s + (e.amount || 0), 0);

  const expectedDrawerCash = (cashSales + cashDeliveries) - drawerCashExpenses;

  const handleExportExpensesCSV = () => {
    const data = expenses.map(e => {
      const dateObj = e.timestamp?.toDate ? e.timestamp.toDate() : null;
      return {
        date: dateObj ? dateObj.toLocaleDateString() : '',
        time: dateObj ? dateObj.toLocaleTimeString() : '',
        category: e.category || 'General',
        recipient: e.recipient || '',
        authorizedBy: e.authorizedBy || '',
        amount: (e.amount || 0).toFixed(2),
        note: e.note || '',
      };
    });

    const headers = {
      date: 'Date',
      time: 'Time',
      category: 'Expense Category',
      recipient: 'Paid To / Recipient',
      authorizedBy: 'Authorized By',
      amount: 'Amount ($)',
      note: 'Expense Description',
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jam_beauty_expenses_${todayStr}.csv`, data, headers);
  };

  const handleExportSummaryCSV = () => {
    const netIncome = grossRevenue - totalExpenses;
    const netMargin = grossRevenue > 0 ? ((netIncome / grossRevenue) * 100).toFixed(1) : '0.0';

    const summaryRows = [
      { metric: 'Report Period', value: formattedPeriodLabel },
      { metric: 'Store POS Sales ($)', value: posSalesTotal.toFixed(2) },
      { metric: 'Delivery Service Revenue ($)', value: deliveryIncome.toFixed(2) },
      { metric: 'Total Gross Revenue ($)', value: grossRevenue.toFixed(2) },
      { metric: 'Total Operating Expenses ($)', value: totalExpenses.toFixed(2) },
      { metric: 'Net Operating Profit ($)', value: netIncome.toFixed(2) },
      { metric: 'Net Profit Margin (%)', value: `${netMargin}%` },
      { metric: 'Expected Physical Drawer Cash ($)', value: expectedDrawerCash.toFixed(2) },
      { metric: 'Electronic & Mobile Money Inflows ($)', value: (grossRevenue - (cashSales + cashDeliveries)).toFixed(2) },
    ];

    const headers = {
      metric: 'Financial Metric',
      value: 'Value',
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jam_beauty_financial_statement_${todayStr}.csv`, summaryRows, headers);
  };

  return (
    <div className="p-4 space-y-4">
      {/* 1. Synchronized Summary Cards (100% in sync with selected period) */}
      <SummaryMetrics sales={sales} expenses={expenses} deliveries={deliveries} />

      {/* 2. Unified Filter Bar shown on non-detailed tabs so all views stay in sync */}
      {activeTab !== 'detailed' && (
        <DateFilterBar
          periodMode={periodMode}
          setPeriodMode={setPeriodMode}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          stepDate={stepDate}
          formattedLabel={formattedPeriodLabel}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
        />
      )}

      {/* 3. Navigation Tabs & Financial Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === id ? 'bg-[#efaa9b] text-[#45150b] font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleExportSummaryCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-[#efaa9b]/60 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#efaa9b]" />
            <span>Export Statement (CSV)</span>
          </button>

          <CashReconciliation
            expectedCash={expectedDrawerCash}
            grossRevenue={grossRevenue}
            cashSales={cashSales}
            deliveryCash={cashDeliveries}
            expenses={totalExpenses}
            dateLabel={formattedPeriodLabel}
          />
        </div>
      </div>

      {/* 4. Tab 1: Detailed Store Performance Deep Report */}
      {activeTab === 'detailed' && (
        <DetailedStoreReport
          sales={sales}
          expenses={expenses}
          deliveries={deliveries}
          periodMode={periodMode}
          setPeriodMode={setPeriodMode}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          stepDate={stepDate}
          formattedPeriodLabel={formattedPeriodLabel}
        />
      )}

      {/* 5. Tab 2: Overview & Sales Ledger */}
      {activeTab === 'overview' && (
        <SalesInflow sales={sales} deliveries={deliveries} />
      )}

      {/* 6. Tab 3: Visual Analytics Charts */}
      {activeTab === 'charts' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Daily Revenue Trend (Store + Delivery)</h3>
            <SalesByDayChart sales={sales} deliveries={deliveries} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Revenue vs Operating Expenses</h3>
              <RevenueVsExpensesChart sales={sales} expenses={expenses} deliveries={deliveries} />
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Payment Methods Distribution</h3>
              <PaymentPieChart sales={sales} deliveries={deliveries} />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-rose-400" /> Top Selling Products by Revenue
            </h3>
            <TopProducts sales={sales} />
          </div>
        </div>
      )}

      {/* 7. Tab 4: Expenses & Restock Outflows Tab */}
      {activeTab === 'expenses' && (() => {
        const restockExpenses = expenses.filter(e => e.isRestockPayment || (e.category || '').toLowerCase().includes('restock') || (e.category || '').toLowerCase().includes('suppl'));
        const overheadExpenses = expenses.filter(e => !restockExpenses.some(r => r.id === e.id));
        const missingReceiptExpenses = expenses.filter(e => (Number(e.amount) >= 50) && !e.receiptImage);

        const filteredExpenses = expenseSubFilter === 'restock' 
          ? restockExpenses 
          : expenseSubFilter === 'overhead' 
            ? overheadExpenses 
            : expenseSubFilter === 'missing_receipt' 
              ? missingReceiptExpenses 
              : expenses;

        return (
          <div className="space-y-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-400" /> Log Outflow / Expense
                </h3>
                {expenses.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportExpensesCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-[#efaa9b]/60 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-[#efaa9b]" />
                    <span>Export Expenses (CSV)</span>
                  </button>
                )}
              </div>
              <ExpenseForm />
            </div>

            {/* Outflows Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setExpenseSubFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
                    expenseSubFilter === 'all'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Outflows ({expenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseSubFilter('restock')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    expenseSubFilter === 'restock'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5 text-rose-400" />
                  <span>📦 Supplier Restocks ({restockExpenses.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseSubFilter('overhead')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    expenseSubFilter === 'overhead'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🏢 Store Overhead ({overheadExpenses.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseSubFilter('missing_receipt')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    expenseSubFilter === 'missing_receipt'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚠️ Missing Receipts (≥$50) ({missingReceiptExpenses.length})</span>
                </button>
              </div>

              <div className="text-xs text-slate-400">
                Filtered Total: <strong className="text-white">${filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0).toFixed(2)}</strong>
              </div>
            </div>

            {/* Expenses Table */}
            {expenses.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-slate-400 border-b border-slate-700">
                      <th className="text-left px-3 py-2.5">Date & Time</th>
                      <th className="text-left px-3 py-2.5">Category</th>
                      <th className="text-left px-3 py-2.5">Recipient / Description</th>
                      <th className="text-center px-3 py-2.5">Funding Source</th>
                      <th className="text-left px-3 py-2.5">Auth By</th>
                      <th className="text-right px-3 py-2.5">Amount</th>
                      <th className="text-center px-3 py-2.5">Proof of Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No expenses matching this category.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map(e => {
                        const amt = Number(e.amount) || 0;
                        const isHigh = amt >= 50;
                        const hasReceipt = !!e.receiptImage;

                        return (
                          <tr key={e.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                              {e.timestamp?.toDate?.() ? e.timestamp.toDate().toLocaleString() : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded font-medium text-[11px] ${
                                (e.category || '').includes('Restock') || (e.category || '').includes('Supplies')
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-slate-700 text-slate-300'
                              }`}>
                                {e.category}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-200">
                              <div className="font-medium text-white">{e.recipient || '—'}</div>
                              {e.note && <div className="text-[10px] text-slate-400 truncate max-w-xs">{e.note}</div>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">
                                {e.paymentMethod === 'cash_drawer' || e.paymentMethod === 'Cash' ? '💵 Cash Drawer' :
                                 e.paymentMethod === 'momo' ? '📱 MoMo' :
                                 e.paymentMethod === 'bank_transfer' ? '🏦 Bank Wire' : (e.paymentMethod || '💵 Cash')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-400">{e.authorizedBy || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-red-400">
                              ${amt.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {hasReceipt ? (
                                <button
                                  type="button"
                                  onClick={() => setInspectedReceipt(e)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-950/40 hover:bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
                                >
                                  <Camera className="w-3 h-3 text-emerald-400" />
                                  <span>View Slip</span>
                                </button>
                              ) : isHigh ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                                  <span>Missing Receipt</span>
                                </span>
                              ) : (
                                <span className="text-slate-600 text-[10px]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* 8. Tab 5: Sales Spreadsheet Import Tab */}
      {activeTab === 'import' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
          <SalesImport
            onImportComplete={() => {
              setPeriodMode('all');
              setActiveTab('detailed');
            }}
          />
        </div>
      )}

      {/* Receipt Preview Lightbox Modal */}
      {inspectedReceipt && (
        <Modal
          isOpen={true}
          onClose={() => setInspectedReceipt(null)}
          title={`Proof of Payment: ${inspectedReceipt.category || 'Disbursement'}`}
        >
          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400">Recipient:</span>{' '}
                <strong className="text-white">{inspectedReceipt.recipient || 'Vendor'}</strong>
              </div>
              <div>
                <span className="text-slate-400">Amount:</span>{' '}
                <strong className="text-rose-400 font-mono text-sm">
                  ${Number(inspectedReceipt.amount).toFixed(2)}
                </strong>
              </div>
            </div>

            {inspectedReceipt.note && (
              <p className="text-slate-400 italic bg-slate-900/50 p-2 rounded-lg">
                "{inspectedReceipt.note}"
              </p>
            )}

            {inspectedReceipt.receiptImage ? (
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center p-2">
                <img
                  src={inspectedReceipt.receiptImage}
                  alt="Receipt slip"
                  className="max-h-[60vh] w-auto max-w-full rounded object-contain shadow-lg"
                />
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">No receipt image attached.</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectedReceipt(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
