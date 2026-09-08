import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import Modal from '../shared/Modal';
import ShiftHandoverModal from './ShiftHandoverModal';
import {
  ChevronLeft, ChevronRight, Calendar, AlertTriangle, CheckCircle2,
  TrendingUp, DollarSign, Package, Tag, Receipt, Percent, Users,
  CreditCard, User, ChevronRight as ArrowIcon, Download, Sparkles, Calculator,
  Search, X
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportCsv';

function StockInventoryList({ items = [], isLowStock = false, format }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products by name, barcode, or category..."
          className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-9 pr-8 py-2 text-white text-xs placeholder-slate-400 focus:outline-none focus:border-[#efaa9b]"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>
          Sorted: <strong>{isLowStock ? 'Lowest to Highest Stock' : 'Highest to Lowest Stock'}</strong>
        </span>
        <span>{filtered.length} products listed</span>
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
        {filtered.map((p, idx) => {
          const isCritical = isLowStock && p.total <= 0;
          return (
            <div
              key={p.id || idx}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                isCritical
                  ? 'bg-rose-950/20 border-rose-800/40 hover:bg-rose-900/30'
                  : 'bg-slate-700/40 hover:bg-slate-700/70 border-slate-600/50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
                    !isLowStock && idx === 0
                      ? 'bg-amber-400 text-amber-950 font-black shadow'
                      : !isLowStock && idx === 1
                        ? 'bg-slate-300 text-slate-950 font-black'
                        : !isLowStock && idx === 2
                          ? 'bg-amber-600 text-white font-black'
                          : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  #{idx + 1}
                </span>

                <div className="min-w-0">
                  <p className="font-semibold text-white text-xs truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                    <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-medium">{p.category || 'Product'}</span>
                    {p.barcode && <span className="font-mono text-slate-500">{p.barcode}</span>}
                    {p.retailPrice > 0 && <span className="text-slate-300">${Number(p.retailPrice).toFixed(2)}</span>}
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span
                  className={`text-xs font-bold block ${
                    p.total <= 0
                      ? 'text-red-400'
                      : p.total <= 5
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }`}
                >
                  {p.total} in stock
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {p.storeroom > 0
                    ? `Showroom: ${p.showroom} · Storeroom: ${p.storeroom}`
                    : `Showroom: ${p.showroom}`}
                </span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-xs text-slate-500 py-6">No matching inventory items found.</p>
        )}
      </div>
    </div>
  );
}

export default function DetailedStoreReport({
  sales = [],
  expenses = [],
  deliveries = [],
  periodMode = 'month',
  setPeriodMode,
  selectedDate = new Date(),
  setSelectedDate,
  stepDate,
  formattedPeriodLabel,
}) {
  const { format } = useCurrency();
  const [products, setProducts] = useState([]);
  const [drilldownModal, setDrilldownModal] = useState(null); // { title, type, data }
  const [shiftHandoverOpen, setShiftHandoverOpen] = useState(false);

  // Fetch live products for inventory stock alerts
  useEffect(() => {
    return onSnapshot(
      collection(db, 'products'),
      snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.warn('Products listener notice:', err)
    );
  }, []);

  // 1. INVENTORY STOCK METRICS (Considering both Showroom + Storeroom)
  const allProductsNormalized = useMemo(() => {
    return products.map(p => {
      const showroom = Number(p.showroomQty) || 0;
      const storeroom = Number(p.storeroomQty) || 0;
      const total = showroom + storeroom;
      return { ...p, showroom, storeroom, total };
    });
  }, [products]);

  // Remaining stocks sorted from HIGHEST TO LOWEST
  const remainingStockItems = useMemo(() => {
    return allProductsNormalized
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total); // Highest first!
  }, [allProductsNormalized]);

  const topRemainingItem = remainingStockItems[0];

  // Low stock sorted from LOWEST TO HIGHEST
  const lowStockItems = useMemo(() => {
    return allProductsNormalized
      .filter(p => p.total <= (p.reorderTrigger || 5))
      .sort((a, b) => a.total - b.total); // Lowest first!
  }, [allProductsNormalized]);

  const lowestStockItem = lowStockItems[0];

  // 2. FINANCIAL CORE CALCULATIONS (Unified from props)
  const totalSalesUSD = sales.reduce((s, item) => s + (item.total || 0), 0);
  const highestSingleSale = sales.length > 0 ? Math.max(...sales.map(s => s.total || 0)) : 0;

  // Approximate or exact Cost of Goods Sold (using product costPrice if present)
  const totalCOGS = sales.reduce((sum, sale) => {
    const saleCost = (sale.items || []).reduce((itemSum, item) => {
      const prod = products.find(p => p.id === item.productId || p.barcode === item.barcode);
      const cost = prod?.costPrice || (item.unitPrice * 0.65); // Fallback to 65% cost ratio
      return itemSum + (cost * item.quantity);
    }, 0);
    return sum + saleCost;
  }, 0);

  const grossProfit = Math.max(0, totalSalesUSD - totalCOGS);
  const highestProfitSale = sales.length > 0 ? Math.max(...sales.map(s => (s.total || 0) * 0.35)) : 0;

  const totalExpenseUSD = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalSalesUSD - totalExpenseUSD;

  // 3. PRODUCT & CATEGORY BREAKDOWN
  const productSalesMap = {};
  const categorySalesMap = {};

  sales.forEach(sale => {
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
  const billCount = sales.length;
  const totalTax = sales.reduce((s, item) => s + (item.tax || 0), 0);
  const totalDiscount = sales.reduce((s, item) => s + (item.discount || 0), 0);
  const highestDiscount = sales.length > 0 ? Math.max(...sales.map(s => s.discount || 0)) : 0;
  const avgSalesValue = billCount > 0 ? (totalSalesUSD / billCount) : 0;

  // 5. CUSTOMER & PAYMENT BREAKDOWN
  const paymentMethodMap = {};
  sales.forEach(s => {
    const method = s.paymentMethod || 'Cash';
    paymentMethodMap[method] = (paymentMethodMap[method] || 0) + (s.total || 0);
  });
  const sortedPayments = Object.entries(paymentMethodMap).sort((a, b) => b[1] - a[1]);
  const topPayment = sortedPayments[0] || ['Cash', 0];

  const cashierMap = {};
  sales.forEach(s => {
    const c = s.cashierName || s.cashierId || 'Cashier';
    cashierMap[c] = (cashierMap[c] || 0) + 1;
  });
  const sortedCashiers = Object.entries(cashierMap).sort((a, b) => b[1] - a[1]);
  const topCashier = sortedCashiers[0] || ['No Cashier', 0];

  // Export Store Performance Report CSV
  const handleExportReportCSV = () => {
    const rows = [
      { metric: 'Report Period', value: formattedPeriodLabel || 'Current Period' },
      { metric: 'Total Sales ($)', value: totalSalesUSD.toFixed(2) },
      { metric: 'Highest Single Bill ($)', value: highestSingleSale.toFixed(2) },
      { metric: 'Gross Profits ($)', value: grossProfit.toFixed(2) },
      { metric: 'Operating Expenses ($)', value: totalExpenseUSD.toFixed(2) },
      { metric: 'Net Profit ($)', value: netProfit.toFixed(2) },
      { metric: 'Top Stock / Product Sold', value: `${topProduct[0]} (${topProduct[1]} units)` },
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
          onClick={() => setDrilldownModal({ title: 'Low Stock Inventory (Lowest to Highest)', type: 'lowStock', data: lowStockItems })}
          className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-red-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              LOW STOCK INVENTORY
            </p>
            <p className="text-base font-extrabold text-red-400 truncate mt-0.5">
              {lowestStockItem ? `${lowestStockItem.name} = ${lowestStockItem.total}` : 'All Stock Healthy'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {lowStockItems.length > 1 ? `${lowStockItems.length - 1} More Inventory are low` : '0 items critically low'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0" />
        </div>

        {/* Remaining Stocks Available Banner (Sorted Highest to Lowest) */}
        <div
          onClick={() => setDrilldownModal({ title: 'Remaining Available Stocks (Highest to Lowest)', type: 'remainingStock', data: remainingStockItems })}
          className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              REMAINING STOCKS
            </p>
            <p className="text-base font-extrabold text-emerald-400 truncate mt-0.5">
              {topRemainingItem ? `${topRemainingItem.name} (${topRemainingItem.total} in stock)` : 'Stock healthy'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              +{Math.max(0, remainingStockItems.length - 1)} other items with available stock
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
        </div>
      </div>

      {/* 2. DATE STEPPER CONTROLS (Synchronized with top cards and all tabs) */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-sm">
        <button
          type="button"
          onClick={() => stepDate ? stepDate(-1) : null}
          disabled={periodMode === 'all'}
          className="p-2 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-slate-300 hover:text-white transition-colors"
          title="Previous Period"
        >
          <ChevronLeft className="w-5 h-5 text-[#efaa9b]" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white text-center">
          <Calendar className="w-4 h-4 text-[#efaa9b] flex-shrink-0" />
          <span>{formattedPeriodLabel || 'Current Period'}</span>
        </div>

        <button
          type="button"
          onClick={() => stepDate ? stepDate(1) : null}
          disabled={periodMode === 'all'}
          className="p-2 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-slate-300 hover:text-white transition-colors"
          title="Next Period"
        >
          <ChevronRight className="w-5 h-5 text-[#efaa9b]" />
        </button>
      </div>

      {/* Quick period presets: Today, Weekly, Monthly, All Time */}
      <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week',  label: 'Weekly' },
            { id: 'month', label: 'Monthly' },
            { id: 'all',   label: 'All Time' },
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodMode ? setPeriodMode(p.id) : null}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                periodMode === p.id
                  ? 'bg-[#efaa9b] text-[#45150b] font-bold shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
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

      {/* 3. THE 12 INFORMATION ROWS (Exact styling from screenshot) */}
      <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl divide-y divide-slate-700/60 overflow-hidden shadow-xl">
        {/* Row 1: TOTAL SALES */}
        <div
          onClick={() => setDrilldownModal({ title: 'Total Sales Bills', type: 'sales', data: sales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL SALES</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{format(totalSalesUSD)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {highestSingleSale > 0 ? `${format(highestSingleSale)} is Highest bill` : 'No sales in this period'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 2: PROFITS (GROSS) */}
        <div
          onClick={() => setDrilldownModal({ title: 'Gross Profits Breakdown', type: 'profits', data: sales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PROFITS</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{format(grossProfit)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{highestProfitSale > 0 ? `${format(highestProfitSale)} is Highest item profit` : '—'}</p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 3: PROFITS (SALES - EXPENSE) */}
        <div
          onClick={() => setDrilldownModal({ title: 'Operating Expenses Breakdown', type: 'expenses', data: expenses })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PROFITS ( SALES - EXPENSE )</p>
            {totalExpenseUSD === 0 ? (
              <p className="text-base font-bold text-[#5b8bf7] mt-0.5">No Expenses in period</p>
            ) : (
              <p className={`text-xl font-extrabold mt-0.5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {format(netProfit)}{' '}
                <span className="text-xs font-normal text-slate-400">(-{format(totalExpenseUSD)} expenses)</span>
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
              {topProduct[0]} : {topProduct[1]} units
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sortedProducts.length > 1 ? `${sortedProducts.length - 1} More items sold` : '0 more'}
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
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5">
              {topCategory[0]} : {topCategory[1]} units
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sortedCategories.length > 1 ? `${sortedCategories.length - 1} Other categories` : '0 more'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 6: SALES (BILLS COUNT) */}
        <div
          onClick={() => setDrilldownModal({ title: 'Transaction Bills', type: 'sales', data: sales })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SALES ( BILLS COUNT )</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{billCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Completed checkout receipts</p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 7: TAX */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TAX</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5">{format(totalTax)}</p>
            <p className="text-xs text-slate-400 mt-0.5">0.00% standard tax</p>
          </div>
        </div>

        {/* Row 8: DISCOUNT */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DISCOUNT</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5">{format(totalDiscount)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{highestDiscount > 0 ? `${format(highestDiscount)} is Highest discount` : 'No discounts applied'}</p>
          </div>
        </div>

        {/* Row 9: CANCELLED / RETURN */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">CANCELLED / RETURN</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5">{format(0)}</p>
            <p className="text-xs text-slate-400 mt-0.5">0 returns recorded</p>
          </div>
        </div>

        {/* Row 10: AVERAGE SALES VALUE */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AVERAGE SALES VALUE</p>
            <p className="text-xl font-extrabold text-[#5b8bf7] mt-0.5">{format(avgSalesValue)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Average ticket size per bill</p>
          </div>
        </div>

        {/* Row 11: PAYMENT BREAKDOWN */}
        <div
          onClick={() => setDrilldownModal({ title: 'Payment Methods Breakdown', type: 'payments', data: sortedPayments })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PAYMENT</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5">
              {topPayment[0]} : {format(topPayment[1])}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sortedPayments.length > 1 ? `${sortedPayments.length - 1} Other payment modes` : 'Primary payment mode'}
            </p>
          </div>
          <ArrowIcon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Row 12: CASHIER BREAKDOWN */}
        <div
          onClick={() => setDrilldownModal({ title: 'Sales by Staff Member', type: 'cashiers', data: sortedCashiers })}
          className="p-4 flex items-center justify-between hover:bg-slate-800/80 cursor-pointer transition-colors group"
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">CASHIER</p>
            <p className="text-base font-bold text-[#5b8bf7] mt-0.5">
              {topCashier[0]} : {topCashier[1]} bills
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {sortedCashiers.length > 1 ? `${sortedCashiers.length - 1} Other active staff` : 'Primary active cashier'}
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
          size="lg"
        >
          <div className="space-y-2 py-1 text-xs">
            {/* Low Stock Searchable List (Lowest to Highest) */}
            {drilldownModal.type === 'lowStock' && (
              <StockInventoryList items={drilldownModal.data} isLowStock={true} format={format} />
            )}

            {/* Remaining Stock Searchable List (Highest to Lowest) */}
            {drilldownModal.type === 'remainingStock' && (
              <StockInventoryList items={drilldownModal.data} isLowStock={false} format={format} />
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
