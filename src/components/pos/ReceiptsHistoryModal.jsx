import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import ReceiptModal from './ReceiptModal';
import { useCurrency } from '../../hooks/useCurrency';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  Receipt,
  Search,
  Calendar,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
  Printer,
  Share2,
  Filter,
  DollarSign,
  Package,
} from 'lucide-react';

export default function ReceiptsHistoryModal({ isOpen, onClose, initialFilter = 'all' }) {
  const { format } = useCurrency();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState(initialFilter); // 'all' | 'credit' | 'paid'
  const [selectedSale, setSelectedSale] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFilterTab(initialFilter);
    setLoading(true);

    try {
      const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
          }));
          setSales(list);
          setLoading(false);
        },
        (err) => {
          console.warn('Error loading sales receipts:', err);
          // Fallback query without orderBy if index is still propagating
          const fallbackQ = collection(db, 'sales');
          onSnapshot(
            fallbackQ,
            (snap) => {
              const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              list.sort((a, b) => {
                const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                return tb - ta;
              });
              setSales(list);
              setLoading(false);
            },
            () => setLoading(false)
          );
        }
      );
      return unsub;
    } catch (e) {
      console.warn('Sales listener error:', e);
      setLoading(false);
    }
  }, [isOpen, initialFilter]);

  if (!isOpen) return null;

  const totalCreditDue = sales.reduce((sum, s) => sum + (s.balanceOwed || 0), 0);
  const creditSalesCount = sales.filter(s => (s.balanceOwed || 0) > 0).length;
  const paidSalesCount = sales.filter(s => !(s.balanceOwed > 0)).length;

  const filteredSales = sales.filter(s => {
    // 1. Tab filter
    if (filterTab === 'credit' && !(s.balanceOwed > 0)) return false;
    if (filterTab === 'paid' && (s.balanceOwed > 0)) return false;

    // 2. Search query filter
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const receiptNo = (s.id || '').toLowerCase();
    const customer = (s.customerName || '').toLowerCase();
    const phone = (s.customerPhone || '').toLowerCase();
    const cashier = (s.cashierName || '').toLowerCase();
    const method = (s.paymentMethod || '').toLowerCase();
    const itemsStr = (s.items || []).map(i => (i.name || '').toLowerCase()).join(' ');

    return (
      receiptNo.includes(q) ||
      customer.includes(q) ||
      phone.includes(q) ||
      cashier.includes(q) ||
      method.includes(q) ||
      itemsStr.includes(q)
    );
  });

  const handleOpenReceipt = (sale) => {
    setSelectedSale(sale);
    setReceiptOpen(true);
  };

  const handleWhatsAppShare = (sale) => {
    const rawPhone = (sale.customerPhone || '').replace(/\D/g, '');
    if (!rawPhone) {
      alert('No customer phone number recorded on this receipt.');
      return;
    }
    const phoneWithCode = rawPhone.startsWith('231') ? rawPhone : `231${rawPhone.replace(/^0+/, '')}`;
    const dateStr = new Date(sale.timestamp?.toDate ? sale.timestamp.toDate() : Date.now()).toLocaleDateString();
    const itemsSummary = (sale.items || [])
      .map(i => `• ${i.name} (x${i.quantity || 1}) - $${((i.unitPrice || 0) * (i.quantity || 1)).toFixed(2)}`)
      .join('\n');

    let msg = `*JAM Beauty Store — Official Receipt Copy*\n`;
    msg += `Receipt #: ${sale.receiptNo || sale.id?.slice(-6).toUpperCase()}\n`;
    msg += `Date: ${dateStr}\n`;
    msg += `Customer: ${sale.customerName || 'Valued Customer'}\n\n`;
    msg += `*Items:*\n${itemsSummary}\n\n`;
    msg += `*Total Order:* $${(sale.total || 0).toFixed(2)}\n`;
    msg += `*Amount Paid:* $${(sale.amountPaid || 0).toFixed(2)}\n`;
    if ((sale.balanceOwed || 0) > 0) {
      msg += `*Outstanding Balance Due:* $${(sale.balanceOwed || 0).toFixed(2)}\n`;
      msg += `Please settle the balance at your earliest convenience.\n\n`;
    }
    msg += `Thank you for shopping with JAM Beauty Store!`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="All Sales Receipts & Disputes Log"
        size="2xl"
        footer={
          <div className="flex justify-between items-center w-full">
            <span className="text-xs text-slate-400">
              Showing {filteredSales.length} of {sales.length} receipts
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Summary Metric Chips */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-900/60 border border-slate-700/70 rounded-xl p-2.5 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Receipts</p>
              <p className="text-base font-bold text-white mt-0.5">{sales.length}</p>
            </div>
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2.5 text-center">
              <p className="text-[10px] uppercase font-bold text-amber-300">Unpaid Credit Debts</p>
              <p className="text-base font-bold text-amber-400 mt-0.5">{creditSalesCount} ({format(totalCreditDue)})</p>
            </div>
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-2.5 text-center">
              <p className="text-[10px] uppercase font-bold text-emerald-300">Paid in Full</p>
              <p className="text-base font-bold text-emerald-400 mt-0.5">{paidSalesCount}</p>
            </div>
          </div>

          {/* Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700 flex-shrink-0">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filterTab === 'all'
                    ? 'bg-[#efaa9b] text-[#45150b]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({sales.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('credit')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filterTab === 'credit'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚠️ Credit Due ({creditSalesCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('paid')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filterTab === 'paid'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Paid in Full ({paidSalesCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by receipt #, customer name, phone, item..."
                className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#efaa9b]"
              />
            </div>
          </div>

          {/* Receipts List */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#efaa9b] border-t-transparent rounded-full animate-spin" />
              <span>Loading receipts archive...</span>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Receipt className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs font-medium">No sales receipts match this filter.</p>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-[#efaa9b] underline hover:text-[#f3c2b7]"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {filteredSales.map(sale => {
                const dateObj = sale.timestamp?.toDate ? sale.timestamp.toDate() : null;
                const formattedDate = dateObj
                  ? dateObj.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }) + ' · ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Recent Sale';

                const isCreditOwed = (sale.balanceOwed || 0) > 0;
                const itemCount = (sale.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);

                return (
                  <div
                    key={sale.id}
                    className={`bg-slate-900/70 border rounded-xl p-3 transition-all hover:border-slate-500 ${
                      isCreditOwed ? 'border-amber-500/60 bg-amber-950/10' : 'border-slate-700'
                    }`}
                  >
                    {/* Top Row: Receipt #, Date, Status */}
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                      <div className="flex items-center gap-2">
                        <div className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono font-bold text-slate-200">
                          #{sale.receiptNo || sale.id?.slice(-6).toUpperCase()}
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formattedDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-300">
                          {sale.paymentMethod || 'Cash'}
                        </span>
                        {isCreditOwed ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 border border-amber-500/50 text-amber-300 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Owes ${Number(sale.balanceOwed).toFixed(2)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Paid
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Customer Info & Items Summary */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 border-t border-slate-800/80 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#efaa9b]" />
                          <span className="font-semibold text-white">
                            {sale.customerName || 'Walk-in Customer'}
                          </span>
                          {sale.customerPhone && (
                            <span className="text-slate-400 font-mono text-[11px] ml-1">
                              ({sale.customerPhone})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-sm">
                          {itemCount} item{itemCount !== 1 ? 's' : ''}:{' '}
                          {(sale.items || []).map(i => `${i.name} (x${i.quantity || 1})`).join(', ')}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm font-bold text-white">
                          Total: <span className="text-[#efaa9b]">${Number(sale.total || 0).toFixed(2)}</span>
                        </p>
                        {isCreditOwed && (
                          <p className="text-[11px] text-amber-300">
                            Paid: ${Number(sale.amountPaid || 0).toFixed(2)} · Balance: ${Number(sale.balanceOwed).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Actions (View Receipt, WhatsApp, Print) */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 mt-2">
                      <span className="text-[10px] text-slate-500">
                        Cashier: {sale.cashierName || 'Staff'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {sale.customerPhone && (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppShare(sale)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-[11px] font-medium transition-colors flex items-center gap-1"
                            title="Send copy of receipt to customer WhatsApp"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(sale)}
                          className="px-3 py-1 rounded-lg bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] text-[11px] font-bold transition-colors flex items-center gap-1 shadow"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>View Receipt</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Embedded Thermal Printable Receipt Modal */}
      <ReceiptModal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        sale={selectedSale}
      />
    </>
  );
}
