import React, { useState } from 'react';
import { useCurrency } from '../../hooks/useCurrency';
import { ShoppingCart, Truck, Search, FileSpreadsheet, Calendar, User, Download } from 'lucide-react';
import { downloadCSV } from '../../utils/exportCsv';

export default function SalesInflow({ sales = [], deliveries = [] }) {
  const { format } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');

  const posTotal = sales.reduce((s, sale) => s + (sale.total || 0), 0);
  const deliveryTotal = deliveries
    .filter(d => d.paymentStatus === 'Paid' || d.cashConfirmed)
    .reduce((s, d) => s + (d.charge || 0), 0);

  const importedCount = sales.filter(s => s.imported).length;

  const filteredSales = sales.filter(s => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const receipt = (s.id || '').toLowerCase();
    const cashier = (s.cashierName || '').toLowerCase();
    const method = (s.paymentMethod || '').toLowerCase();
    const itemNames = (s.items || []).map(i => (i.name || '').toLowerCase()).join(' ');

    return receipt.includes(q) || cashier.includes(q) || method.includes(q) || itemNames.includes(q);
  });

  const handleExportSalesCSV = () => {
    const data = filteredSales.map(s => {
      const dateObj = s.timestamp?.toDate ? s.timestamp.toDate() : null;
      const itemsStr = (s.items || []).map(i => `${i.name} (x${i.quantity || 1} @ $${(i.unitPrice || 0).toFixed(2)})`).join('; ');
      return {
        date: dateObj ? dateObj.toLocaleDateString() : '',
        time: dateObj ? dateObj.toLocaleTimeString() : '',
        receiptNo: s.id?.slice(-8).toUpperCase() || '',
        cashier: s.cashierName || 'Staff',
        paymentMethod: s.paymentMethod || 'Cash',
        items: itemsStr,
        itemCount: (s.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0),
        totalAmount: (s.total || 0).toFixed(2),
        isImported: s.imported ? 'YES' : 'NO',
      };
    });

    const headers = {
      date: 'Date',
      time: 'Time',
      receiptNo: 'Receipt #',
      cashier: 'Cashier / Staff',
      paymentMethod: 'Payment Method',
      items: 'Items Breakdown',
      itemCount: 'Total Pieces',
      totalAmount: 'Total Sale Amount ($)',
      isImported: 'Historical Import',
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jam_beauty_sales_ledger_${todayStr}.csv`, data, headers);
  };

  return (
    <div className="space-y-4">
      {/* Overview Inflow Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Total Sales Recorded</p>
            <p className="text-lg font-bold text-white">{format(posTotal)}</p>
            <p className="text-xs text-slate-500">{sales.length} transactions in period</p>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Delivery Revenue</p>
            <p className="text-lg font-bold text-white">{format(deliveryTotal)}</p>
            <p className="text-xs text-slate-500">
              {deliveries.filter(d => d.paymentStatus === 'Paid' || d.cashConfirmed).length} confirmed orders
            </p>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Historical / Imported</p>
            <p className="text-lg font-bold text-purple-300">{importedCount} Sales</p>
            <p className="text-xs text-slate-500">Integrated into financial ledger</p>
          </div>
        </div>
      </div>

      {/* Search & Transaction Ledger */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>Sales & Receipts Ledger</span>
            <span className="text-xs text-slate-400 font-normal">({filteredSales.length} records)</span>
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search items, receipt, cashier..."
                className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#efaa9b]"
              />
            </div>

            <button
              type="button"
              onClick={handleExportSalesCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-[#efaa9b]/60 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[#efaa9b]" />
              <span className="hidden sm:inline">Export Sales (CSV)</span>
              <span className="sm:hidden">CSV</span>
            </button>
          </div>
        </div>

        {filteredSales.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                  <th className="text-left px-3 py-2.5">Date & Time</th>
                  <th className="text-left px-3 py-2.5">Receipt #</th>
                  <th className="text-left px-3 py-2.5">Items Purchased</th>
                  <th className="text-left px-3 py-2.5">Cashier</th>
                  <th className="text-left px-3 py-2.5">Payment</th>
                  <th className="text-right px-3 py-2.5">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => {
                  const dateObj = s.timestamp?.toDate ? s.timestamp.toDate() : null;
                  const dateStr = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                  const timeStr = dateObj ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

                  const itemsDesc = (s.items || []).map(i => `${i.name} (x${i.quantity || 1})`).join(', ');

                  return (
                    <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-800/60 transition-colors">
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                        <div className="font-medium text-white">{dateStr}</div>
                        <div className="text-[10px] text-slate-500">{timeStr}</div>
                      </td>

                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">
                        <span className="bg-slate-700/50 px-1.5 py-0.5 rounded text-[11px]">
                          {s.id?.slice(-8).toUpperCase()}
                        </span>
                        {s.imported && (
                          <span className="ml-1.5 text-[10px] bg-purple-900/50 text-purple-300 border border-purple-700/50 px-1 py-0.2 rounded">
                            Imported
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-slate-300 max-w-xs truncate" title={itemsDesc}>
                        {itemsDesc || '1 item'}
                      </td>

                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                        {s.cashierName || '—'}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300 text-[11px]">
                          {s.paymentMethod || 'Cash'}
                        </span>
                      </td>

                      <td className="px-3 py-2 text-right font-bold text-rose-300 text-sm whitespace-nowrap">
                        {format(s.total || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-500">
            <p className="text-sm">No sales transactions found for this period.</p>
            <p className="text-xs mt-1">Select "All Time (Inc. Imported)" above to view all historical data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
