import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import Modal from '../shared/Modal';
import ShiftHandoverModal from './ShiftHandoverModal';
import {
  ChevronLeft, ChevronRight, Calendar, AlertTriangle, CheckCircle2,
  TrendingUp, DollarSign, Package, Tag, Receipt, Percent, Users,
  CreditCard, User, ChevronRight as ArrowIcon, Download, Sparkles, Calculator
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportCsv';

export default function DetailedStoreReport({ sales = [], expenses = [], deliveries = [] }) {
  const { format } = useCurrency();
  const [products, setProducts] = useState([]);
  const [drilldownModal, setDrilldownModal] = useState(null); // { title, type, data }
  const [shiftHandoverOpen, setShiftHandoverOpen] = useState(false);

  // Date stepper state (defaults to today)
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateFilterMode, setDateFilterMode] = useState('day'); // 'day' | 'week' | 'month' | 'all'

  // Fetch live products for inventory stock alerts
  useEffect(() => {
    return onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Step backward or forward in time
  const stepDate = (offset) => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + offset);
      return next;
    });
    setDateFilterMode('day');
  };

  // Filter sales, expenses, and deliveries according to the selected date or period
  const filterByDate = (items) => {
    if (dateFilterMode === 'all') return items;

    return items.filter(item => {
      const date = item.timestamp?.toDate ? item.timestamp.toDate() : null;
      if (!date) return false;

      if (dateFilterMode === 'day') {
        return (
          date.getFullYear() === currentDate.getFullYear() &&
          date.getMonth() === currentDate.getMonth() &&
          date.getDate() === currentDate.getDate()
        );
      }
      return true;
    });
  };

  const periodSales = filterByDate(sales);
  const periodExpenses = filterByDate(expenses);
  const periodDeliveries = filterByDate(deliveries);

  // 1. INVENTORY STOCK METRICS
  const sortedByStock = [...products].sort((a, b) => (a.showroomQty || 0) - (b.showroomQty || 0));
  const lowStockItems = sortedByStock.filter(p => (p.showroomQty || 0) <= 5);
  const lowestStockItem = sortedByStock[0];

  const availableStockItems = sortedByStock.filter(p => (p.showroomQty || 0) > 0);
  const topRemainingItem = [...products].sort((a, b) => (b.showroomQty || 0) - (a.showroomQty || 0))[0];

  // 2. FINANCIAL CORE CALCULATIONS
  const totalSalesUSD = periodSales.reduce((s, item) => s + (item.total || 0), 0);
  const highestSingleSale = periodSales.length > 0 ? Math.max(...periodSales.map(s => s.total || 0)) : 0;

  // Approximate or exact Cost of Goods Sold (using product costPrice if present)
  const totalCOGS = periodSales.reduce((sum, sale) => {
    const saleCost = (sale.items || []).reduce((itemSum, item) => {
      const prod = products.find(p => p.id === item.productId || p.barcode === item.barcode);
      const cost = prod?.costPrice || (item.unitPrice * 0.65); // Fallback to 65% cost ratio
      return itemSum + (cost * item.quantity);
    }, 0);
    return sum + saleCost;
  }, 0);

  const grossProfit = Math.max(0, totalSalesUSD - totalCOGS);
  const highestProfitSale = periodSales.length > 0 ? Math.max(...periodSales.map(s => (s.total || 0) * 0.35)) : 0;

  const totalExpenseUSD = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalSalesUSD - totalExpenseUSD;

  // 3. PRODUCT & CATEGORY BREAKDOWN
  const productSalesMap = {};
  const categorySalesMap = {};

  periodSales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const pName = item.name || 'Unknown Item';
      const qty = item.quantity || 1;
      productSalesMap[pName] = (productSalesMap[pName] || 0) + qty;

      const prod = products.find(p => p.id === item.productId || p.barcode === item.barcode);
      const cat = prod?.category || 'Perfume';
      categorySalesMap[cat] = (categorySalesMap[cat] || 0) + qty;
    });
  });

  const sortedProducts = Object.entries(productSalesMap).sort((a, b) => b[1] - a[1]);
  const topProduct = sortedProducts[0] || ['No sales yet', 0];

  const sortedCategories = Object.entries(categorySalesMap).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0] || ['No category yet', 0];

  // 4. TRANSACTION METRICS
  const billCount = periodSales.length;
  const totalTax = periodSales.reduce((s, item) => s + (item.tax || 0), 0);
  const totalDiscount = periodSales.reduce((s, item) => s + (item.discount || 0), 0);
  const highestDiscount = periodSales.length > 0 ? Math.max(...periodSales.map(s => s.discount || 0)) : 0;
  const avgSalesValue = billCount > 0 ? (totalSalesUSD / billCount) : 0;

  // 5. CUSTOMER & PAYMENT BREAKDOWN
  const paymentMethodMap = {};
  periodSales.forEach(s => {
    const method = s.paymentMethod || 'Cash';
    paymentMethodMap[method] = (paymentMethodMap[method] || 0) + (s.total || 0);
  });
  const sortedPayments = Object.entries(paymentMethodMap).sort((a, b) => b[1] - a[1]);
  const topPayment = sortedPayments[0] || ['Cash', 0];

  const cashierMap = {};
  periodSales.forEach(s => {
    const c = s.cashierName || s.cashierId || 'Cashier 1';
    cashierMap[c] = (cashierMap[c] || 0) + 1;
  });
  const sortedCashiers = Object.entries(cashierMap).sort((a, b) => b[1] - a[1]);
  const topCashier = sortedCashiers[0] || ['No Cashier', 0];

  // Formatted Date Label
  const isToday = currentDate.toDateString() === new Date().toDateString();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = currentDate.toDateString() === yesterday.toDateString();

  const formattedDate = isToday
    ? `Today : ${currentDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}`
    : isYesterday
      ? `Yesterday : ${currentDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}`
      : currentDate.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  // Export Store Performance Report CSV
  const handleExportReportCSV = () => {
    const rows = [
      { metric: 'Report Period', value: formattedDate },
      { metric: 'Total Sales ($)', value: totalSalesUSD.toFixed(2) },
      { metric: 'Highest Single Bill ($)', value: highestSingleSale.toFixed(2) },
      { metric: 'Gross Profits ($)', value: grossProfit.toFixed(2) },
      { metric: 'Operating Expenses ($)', value: totalExpenseUSD.toFixed(2) },
      { metric: 'Net Profit ($)', value: netProfit.toFixed(2) },
      { metric: 'Top Stock / Product', value: `${topProduct[0]} (${topProduct[1]} units)` },
      { metric: 'Top Category', value: `${topCategory[0]} (${topCategory[1]} units)` },
      { metric: 'Sales (Bills Count)', value: billCount },
      { metric: 'Tax Collected ($)', value: totalTax.toFixed(2) },
      { metric: 'Discounts Given ($)', value: totalDiscount.toFixed(2) },
      { metric: 'Average Sales Value ($)', value: avgSalesValue.toFixed(2) },
      { metric: 'Primary Payment Mode', value: `${topPayment[0]} ($${topPayment[1].toFixed(2)})` },
      { metric: 'Top Cashier', value: `${topCashier[0]} (${topCashier[1]} bills)` },
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jam_beauty_store_performance_${todayStr}.csv`, rows, { metric: 'Store Metric', value: 'Value' });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3 pb-8">
      {/* 1. TOP INVENTORY STOCK BANNERS */}
      <div className="space-y-2">
        {/* Low Stock Alert Banner */}
        <div
          onClick={() => setDrilldownModal({ title: 'Low Stock Inventory', type: 'lowStock', data: lowStockItems })}
          className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-red-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              LOW STOCK INVENTORY
            </p>
            <p className="text-base font-extrabold text-red-400 truncate mt-0.5">
              {lowestStockItem ? `${lowestStockItem.name} = ${lowestStockItem.showroomQty || 0}` : 'All Stock Healthy'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {lowStockItems.length > 1 ? `${lowStockItems.length - 1} More Inventory are low` : '0 items critically low'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0" />
        </div>

        {/* Remaining Stocks Available Banner */}
        <div
          onClick={() => setDrilldownModal({ title: 'Remaining Available Stock', type: 'remainingStock', data: availableStockItems })}
          className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              REMAINING STOCKS
            </p>
            <p className="text-base font-extrabold text-emerald-400 truncate mt-0.5">
              {topRemainingItem ? `${topRemainingItem.name} (${topRemainingItem.showroomQty || 0} in stock)` : 'Stock healthy'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              +{Math.max(0, products.length - 1)} other items with available stock
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
        </div>
      </div>

      {/* 2. DATE STEPPER CONTROLS (Exact layout from image: [<] [📅 Yesterday : 07 Sep] [>]) */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-sm">
        <button
          type="button"
          onClick={() => stepDate(-1)}
          className="p-2 bg-slate-700/60 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
          title="Previous Day"
        >
          <ChevronLeft className="w-5 h-5 text-[#efaa9b]" />
        </button>

        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Calendar className="w-4 h-4 text-[#efaa9b]" />
          <span>{formattedDate}</span>
        </div>

        <button
          type="button"
          onClick={() => stepDate(1)}
          className="p-2 bg-slate-700/60 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors"
          title="Next Day"
        >
          <ChevronRight className="w-5 h-5 text-[#efaa9b]" />
        </button>
      </div>

      {/* Quick period presets */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'day', label: isToday ? 'Today' : 'Selected Day' },
            { id: 'all', label: 'All Time' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setDateFilterMode(p.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
                dateFilterMode === p.id
                  ? 'bg-[#efaa9b] text-[#45150b] shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShiftHandoverOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Shift Handover (Z-Report)</span>
          </button>

          <button
            type="button"
            onClick={handleExportReportCSV}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#efaa9b]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 3. THE 12 INFORMATION ROWS (Exact styling from image) */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl divide-y divide-slate-700/60 overflow-hidden shadow-xl">
        {/* Row 1: TOTAL SALES */}
        <div
          onClick={() => setDrilldownModal({ title: 'Total Sales Bills', type: 'sales', data: periodSales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL SALES</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{format(totalSalesUSD)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{highestSingleSale > 0 ? `${format(highestSingleSale)} is Highest` : 'No sales yet'}</p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 2: PROFITS (GROSS) */}
        <div
          onClick={() => setDrilldownModal({ title: 'Gross Profits', type: 'profits', data: periodSales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PROFITS</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{format(grossProfit)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{highestProfitSale > 0 ? `${format(highestProfitSale)} is Highest` : '—'}</p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 3: PROFITS (SALES - EXPENSE) */}
        <div
          onClick={() => setDrilldownModal({ title: 'Operating Expenses', type: 'expenses', data: periodExpenses })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PROFITS ( SALES - EXPENSE )</p>
            {totalExpenseUSD === 0 ? (
              <p className="text-base font-bold text-[#5b8bf7] mt-0.5">No Expenses</p>
            ) : (
              <p className={`text-xl font-extrabold mt-0.5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {format(netProfit)}{' '}
                <span className="text-xs font-normal text-slate-400">(-{format(totalExpenseUSD)} exp)</span>
              </p>
            )}
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 4: TOP STOCKS */}
        <div
          onClick={() => setDrilldownModal({ title: 'Top Stocks Sold', type: 'topStocks', data: sortedProducts })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOP STOCKS</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5">
              {topProduct[0]} : {topProduct[1]}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sortedProducts.length > 1 ? `${sortedProducts.length - 1} More` : '0 more'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 5: TOP CATEGORY */}
        <div
          onClick={() => setDrilldownModal({ title: 'Sales by Category', type: 'categories', data: sortedCategories })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOP CATEGORY</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5 uppercase">
              {topCategory[0]} : {topCategory[1]}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sortedCategories.length > 1 ? `${sortedCategories.length - 1} More` : '0 more'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 6: SALES (TRANSACTIONS COUNT) */}
        <div
          onClick={() => setDrilldownModal({ title: 'Bills Issued', type: 'sales', data: periodSales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SALES</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{billCount}</p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 7: TAX */}
        <div
          onClick={() => setDrilldownModal({ title: 'Tax Details', type: 'tax', data: periodSales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TAX</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{format(totalTax)}</p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 8: DISCOUNT */}
        <div
          onClick={() => setDrilldownModal({ title: 'Discounts Granted', type: 'discount', data: periodSales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DISCOUNT</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{format(totalDiscount)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {highestDiscount > 0 ? `${format(highestDiscount)} is Highest` : 'No discounts applied'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 9: AVG SALES VALUE */}
        <div
          onClick={() => setDrilldownModal({ title: 'Average Sales Value Analysis', type: 'avgSales', data: periodSales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AVG SALES VALUE</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{format(avgSalesValue)}</p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 10: TOP CUSTOMER */}
        <div
          onClick={() => setDrilldownModal({ title: 'Customers', type: 'customer', data: [] })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOP CUSTOMER</p>
            <p className="text-xs text-slate-400 mt-1">No Sales Link to any Customer!</p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 11: PAYMENT MODES */}
        <div
          onClick={() => setDrilldownModal({ title: 'Payment Modes Breakdown', type: 'payments', data: sortedPayments })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PAYMENT MODES</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5">
              {topPayment[0]} : {format(topPayment[1])}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sortedPayments.length > 1 ? `${sortedPayments.length - 1} more modes!` : 'Primary mode'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 12: SOLD BY (CASHIER) */}
        <div
          onClick={() => setDrilldownModal({ title: 'Cashier Sales Volume', type: 'cashiers', data: sortedCashiers })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SOLD BY</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5 lowercase truncate">
              {topCashier[0]}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sortedCashiers.length === 1 ? 'only 1 Cashier!' : `${sortedCashiers.length} Cashiers active`}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* DRILL-DOWN INTERACTIVE MODAL */}
      {drilldownModal && (
        <Modal
          isOpen={!!drilldownModal}
          onClose={() => setDrilldownModal(null)}
          title={drilldownModal.title}
          size="md"
        >
          <div className="space-y-2 py-1 text-xs">
            {drilldownModal.type === 'lowStock' && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {drilldownModal.data.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-xl">
                    <span className="font-semibold text-white truncate mr-2">{p.name}</span>
                    <span className="text-red-400 font-bold flex-shrink-0">{p.showroomQty || 0} in stock</span>
                  </div>
                ))}
              </div>
            )}

            {drilldownModal.type === 'remainingStock' && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {drilldownModal.data.slice(0, 50).map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-xl">
                    <span className="font-semibold text-white truncate mr-2">{p.name}</span>
                    <span className="text-emerald-400 font-bold flex-shrink-0">{p.showroomQty || 0} in stock</span>
                  </div>
                ))}
              </div>
            )}

            {drilldownModal.type === 'topStocks' && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {drilldownModal.data.map(([name, qty], i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-xl">
                    <span className="font-semibold text-white">{name}</span>
                    <span className="text-[#efaa9b] font-bold">{qty} units sold</span>
                  </div>
                ))}
              </div>
            )}

            {drilldownModal.type === 'categories' && (
              <div className="space-y-1.5">
                {drilldownModal.data.map(([cat, qty], i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-xl">
                    <span className="font-semibold text-white">{cat}</span>
                    <span className="text-emerald-400 font-bold">{qty} items</span>
                  </div>
                ))}
              </div>
            )}

            {drilldownModal.type === 'payments' && (
              <div className="space-y-1.5">
                {drilldownModal.data.map(([method, amt], i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-xl">
                    <span className="font-semibold text-white">{method}</span>
                    <span className="text-emerald-400 font-bold">{format(amt)}</span>
                  </div>
                ))}
              </div>
            )}

            {drilldownModal.type === 'cashiers' && (
              <div className="space-y-1.5">
                {drilldownModal.data.map(([c, count], i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-700/50 rounded-xl">
                    <span className="font-semibold text-white">{c}</span>
                    <span className="text-[#efaa9b] font-bold">{count} bills completed</span>
                  </div>
                ))}
              </div>
            )}

            {drilldownModal.type === 'sales' && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {drilldownModal.data.map((s, i) => (
                  <div key={i} className="p-2.5 bg-slate-700/50 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">Receipt #{s.id?.slice(-6).toUpperCase()}</p>
                      <p className="text-[10px] text-slate-400">{s.paymentMethod} · {s.cashierName || 'Cashier'}</p>
                    </div>
                    <span className="font-bold text-emerald-400">{format(s.total)}</span>
                  </div>
                ))}
              </div>
            )}

            {drilldownModal.type === 'expenses' && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {drilldownModal.data.map((e, i) => (
                  <div key={i} className="p-2.5 bg-slate-700/50 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{e.category}: {e.recipient || 'Expense'}</p>
                      <p className="text-[10px] text-slate-400">{e.note || 'No description'}</p>
                    </div>
                    <span className="font-bold text-red-400">${Number(e.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {(!drilldownModal.data || drilldownModal.data.length === 0) && (
              <p className="text-slate-400 text-center py-4">No records to display for this metric.</p>
            )}
          </div>
        </Modal>
      )}

      {/* Shift Handover Z-Report Modal */}
      <ShiftHandoverModal
        isOpen={shiftHandoverOpen}
        onClose={() => setShiftHandoverOpen(false)}
        sales={sales}
        expenses={expenses}
      />
    </div>
  );
}
