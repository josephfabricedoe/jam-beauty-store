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
import { BarChart2, List, CreditCard, Upload, Download, Sparkles } from 'lucide-react';
import { downloadCSV } from '../../utils/exportCsv';

const TABS = [
  { id: 'detailed', label: 'Store Deep Report', icon: Sparkles },
  { id: 'overview', label: 'Ledger & Inflows',  icon: List },
  { id: 'charts',   label: 'Visual Charts',     icon: BarChart2 },
  { id: 'expenses', label: 'Expenses',          icon: CreditCard },
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

  // Exact Physical Drawer Cash Calculations
  const cashSales = sales
    .filter(s => (s.paymentMethod || 'Cash').toLowerCase() === 'cash')
    .reduce((s, sale) => s + (sale.total || 0), 0);

  const cashDeliveries = deliveries
    .filter(d => (d.paymentStatus === 'Paid' || d.cashConfirmed) && (d.paymentStatus === 'COD' || d.paymentStatus === 'Paid'))
    .reduce((s, d) => s + (d.charge || 0), 0);

  const expectedDrawerCash = (cashSales + cashDeliveries) - totalExpenses;

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

      {/* 7. Tab 4: Expenses Tab */}
      {activeTab === 'expenses' && (
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
          {expenses.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-slate-400">
                    <th className="text-left px-3 py-2">Time</th>
                    <th className="text-left px-3 py-2">Category</th>
                    <th className="text-left px-3 py-2">Recipient</th>
                    <th className="text-left px-3 py-2">Auth By</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-slate-400">
                        {e.timestamp?.toDate?.() ? e.timestamp.toDate().toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{e.category}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{e.recipient || '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{e.authorizedBy || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-400">
                        ${Number(e.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
