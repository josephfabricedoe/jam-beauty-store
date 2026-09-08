import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import Modal from '../shared/Modal';
import ReceiptModal from '../pos/ReceiptModal';
import {
  Users,
  UserPlus,
  Phone,
  CreditCard,
  Search,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowDownRight,
  Edit2,
  Receipt,
  Share2,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
} from 'lucide-react';

const CUSTOMER_TYPES = ['Salon / Hair Stylist', 'Wholesale Reseller', 'VIP Client', 'Regular Retail'];

export default function CustomerAccountsView() {
  const { format } = useCurrency();

  // Active top tab: 'accounts' | 'receipts'
  const [activeTab, setActiveTab] = useState('accounts');

  // Firestore raw collections
  const [registeredCustomers, setRegisteredCustomers] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('all'); // 'all' | 'debtors' | 'cleared'
  const [receiptFilter, setReceiptFilter] = useState('all'); // 'all' | 'credit' | 'paid'

  // Modals & Selection state
  const [modalOpen, setModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  // Receipt Modal state
  const [viewingSale, setViewingSale] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Customer Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState('VIP Client');
  const [creditLimit, setCreditLimit] = useState('500');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Subscribe to live Firestore collections
  useEffect(() => {
    setLoading(true);

    // 1. Customers registry
    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        setRegisteredCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn('Customer registry notice:', err);
        setLoading(false);
      }
    );

    // 2. Sales collection (for automatic customer linking, credit sales, and receipt lookup)
    const unsubSales = onSnapshot(
      collection(db, 'sales'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort newest first
        list.sort((a, b) => {
          const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
          const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
          return tb - ta;
        });
        setSalesList(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Sales archive notice:', err);
        setLoading(false);
      }
    );

    // 3. Customer debt payments
    const unsubPayments = onSnapshot(
      collection(db, 'customerPayments'),
      (snap) => {
        setPaymentsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn('Payments notice:', err)
    );

    return () => {
      unsubCustomers();
      unsubSales();
      unsubPayments();
    };
  }, []);

  // Merge registered customers with all customers discovered in sales records
  const mergedCustomers = useMemo(() => {
    const map = new Map();

    // 1. Add all registered customers from 'customers' collection
    registeredCustomers.forEach(c => {
      const key = (c.phone || c.name || c.id).trim().toLowerCase();
      map.set(key, {
        id: c.id,
        isRegistered: true,
        name: c.name,
        phone: c.phone || '',
        customerType: c.customerType || 'VIP Client',
        creditLimit: Number(c.creditLimit || 500),
        balanceOwed: Number(c.balanceOwed || 0),
        totalSpent: Number(c.totalSpent || 0),
        sales: [],
        payments: [],
      });
    });

    // 2. Scan sales and associate with customers, or create new entries for customers who bought on credit
    salesList.forEach(s => {
      const sName = (s.customerName || '').trim();
      const sPhone = (s.customerPhone || '').trim();
      const hasCredit = (s.balanceOwed || 0) > 0 || s.isStoreCredit || s.isPartialCredit;
      const isNamed = sName && sName.toLowerCase() !== 'walk-in customer';

      if (!isNamed && !hasCredit) return;

      // Match by phone first, then by name, then by customerId
      let matchKey = null;
      if (sPhone && map.has(sPhone.toLowerCase())) {
        matchKey = sPhone.toLowerCase();
      } else if (sName && map.has(sName.toLowerCase())) {
        matchKey = sName.toLowerCase();
      } else if (s.customerId) {
        for (const [k, cust] of map.entries()) {
          if (cust.id === s.customerId) {
            matchKey = k;
            break;
          }
        }
      }

      if (!matchKey) {
        // Create customer entry synthesized from sale
        matchKey = (sPhone || sName || s.id).toLowerCase();
        map.set(matchKey, {
          id: s.customerId || `sales_cust_${matchKey.replace(/[^a-z0-9]/g, '_')}`,
          isRegistered: false,
          name: sName || 'Credit Customer',
          phone: sPhone || '',
          customerType: 'VIP Client',
          creditLimit: 500,
          balanceOwed: 0,
          totalSpent: 0,
          sales: [],
          payments: [],
        });
      }

      map.get(matchKey).sales.push(s);
    });

    // 3. For each customer, reconcile sales, calculate exact balances, and attach payments
    const result = Array.from(map.values()).map(cust => {
      // Sort sales newest first
      cust.sales.sort((a, b) => {
        const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
        const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
        return tb - ta;
      });

      // Find payments matching this customer
      const matchingPayments = paymentsList.filter(
        p => p.customerId === cust.id || (cust.phone && p.customerPhone === cust.phone) || (cust.name && p.customerName === cust.name)
      );
      cust.payments = matchingPayments;
      const totalPaidBack = matchingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Reconcile balance owed: if not registered or balance is 0, sum unpaid credit from sales minus repayments
      const totalCreditFromSales = cust.sales.reduce((sum, s) => sum + (s.balanceOwed || 0), 0);
      if (!cust.isRegistered || cust.balanceOwed === 0) {
        cust.balanceOwed = Math.max(0, totalCreditFromSales - totalPaidBack);
      } else {
        // Even if registered, ensure balance reflects credit sales
        cust.balanceOwed = Math.max(cust.balanceOwed, totalCreditFromSales - totalPaidBack);
      }

      // Total lifetime sales spent
      const salesTotal = cust.sales.reduce((sum, s) => sum + (s.total || 0), 0);
      cust.totalSpent = Math.max(cust.totalSpent, salesTotal);

      // Most recent sale date
      cust.lastSaleDate = cust.sales[0]?.timestamp;

      return cust;
    });

    // Sort: customers owing money first (descending balance), then alphabetical
    result.sort((a, b) => {
      if (b.balanceOwed !== a.balanceOwed) {
        return b.balanceOwed - a.balanceOwed;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [registeredCustomers, salesList, paymentsList]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return mergedCustomers.filter(c => {
      // Filter tab
      if (accountFilter === 'debtors' && !(c.balanceOwed > 0)) return false;
      if (accountFilter === 'cleared' && (c.balanceOwed > 0)) return false;

      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.customerType || '').toLowerCase().includes(q)
      );
    });
  }, [mergedCustomers, searchTerm, accountFilter]);

  // Filtered sales receipts
  const filteredSales = useMemo(() => {
    return salesList.filter(s => {
      // Tab filter
      if (receiptFilter === 'credit' && !(s.balanceOwed > 0)) return false;
      if (receiptFilter === 'paid' && (s.balanceOwed > 0)) return false;

      // Search query
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const rNo = (s.receiptNo || s.id || '').toLowerCase();
      const cName = (s.customerName || '').toLowerCase();
      const cPhone = (s.customerPhone || '').toLowerCase();
      const cCashier = (s.cashierName || '').toLowerCase();
      const cMethod = (s.paymentMethod || '').toLowerCase();
      const itemsStr = (s.items || []).map(i => (i.name || '').toLowerCase()).join(' ');

      return (
        rNo.includes(q) ||
        cName.includes(q) ||
        cPhone.includes(q) ||
        cCashier.includes(q) ||
        cMethod.includes(q) ||
        itemsStr.includes(q)
      );
    });
  }, [salesList, searchTerm, receiptFilter]);

  // Aggregate metrics
  const totalOwed = mergedCustomers.reduce((sum, c) => sum + (c.balanceOwed || 0), 0);
  const totalSpentAll = salesList.reduce((sum, s) => sum + (s.total || 0), 0);
  const debtorsCount = mergedCustomers.filter(c => (c.balanceOwed || 0) > 0).length;

  const openAddModal = () => {
    setEditCustomer(null);
    setName('');
    setPhone('');
    setCustomerType('VIP Client');
    setCreditLimit('500');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditCustomer(c);
    setName(c.name || '');
    setPhone(c.phone || '');
    setCustomerType(c.customerType || 'VIP Client');
    setCreditLimit(String(c.creditLimit || '500'));
    setError('');
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        customerType,
        creditLimit: parseFloat(creditLimit) || 0,
        updatedAt: serverTimestamp(),
      };

      if (editCustomer && editCustomer.isRegistered) {
        await updateDoc(doc(db, 'customers', editCustomer.id), payload);
      } else {
        await addDoc(collection(db, 'customers'), {
          ...payload,
          balanceOwed: editCustomer?.balanceOwed || 0,
          totalSpent: editCustomer?.totalSpent || 0,
          createdAt: serverTimestamp(),
        });
      }
      setModalOpen(false);
    } catch (err) {
      setError('Failed to save customer: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSaving(true);
    try {
      const newBalance = Math.max(0, (selectedCustomer.balanceOwed || 0) - amount);

      // 1. Update customer doc if registered
      if (selectedCustomer.isRegistered) {
        await updateDoc(doc(db, 'customers', selectedCustomer.id), {
          balanceOwed: newBalance,
          lastPaymentAmount: amount,
          lastPaymentDate: serverTimestamp(),
        });
      }

      // 2. Log in customerPayments ledger
      await addDoc(collection(db, 'customerPayments'), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone || '',
        amount,
        remainingBalance: newBalance,
        note: paymentNote.trim() || 'Debt payment',
        timestamp: serverTimestamp(),
      });

      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (err) {
      alert('Payment recording notice: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReceipt = (sale) => {
    setViewingSale(sale);
    setReceiptModalOpen(true);
  };

  const handleWhatsAppCustomer = (cust) => {
    const rawPhone = (cust.phone || '').replace(/\D/g, '');
    if (!rawPhone) {
      alert('No phone number recorded for this customer.');
      return;
    }
    const phoneWithCode = rawPhone.startsWith('231') ? rawPhone : `231${rawPhone.replace(/^0+/, '')}`;

    let msg = `Hello ${cust.name},\nThis is JAM Beauty Store.\n`;
    if (cust.balanceOwed > 0) {
      msg += `Your current outstanding store credit balance is *${format(cust.balanceOwed)}*.\n`;
      msg += `Please visit our store or send Mobile Money to settle your account at your earliest convenience.\n\n`;
    } else {
      msg += `Thank you for being a valued VIP client of JAM Beauty Store!\n\n`;
    }
    msg += `Thank you for choosing JAM Beauty Store!`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const formatSaleDate = (ts) => {
    if (!ts) return 'Recent';
    const dateObj = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    return dateObj.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#efaa9b]" />
            <span>Customers & VIP Accounts</span>
          </h2>
          <p className="text-xs text-slate-400">Client credit tracking, linked sales history & receipt archive</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Dual Tabs */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'accounts'
                  ? 'bg-[#efaa9b] text-[#45150b] shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Accounts & Debts ({mergedCustomers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('receipts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'receipts'
                  ? 'bg-[#efaa9b] text-[#45150b] shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>All Receipts Log ({salesList.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-bold transition-colors shadow-md shadow-[#efaa9b]/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>New VIP Account</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Registered & Credit Clients</p>
          <p className="text-xl font-bold text-white mt-0.5">
            {mergedCustomers.length} Accounts
            {debtorsCount > 0 && (
              <span className="text-xs font-bold text-amber-400 ml-2">({debtorsCount} owe store)</span>
            )}
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Outstanding Debt (Store Credit)</p>
          <p className="text-xl font-bold text-red-400 mt-0.5">{format(totalOwed)}</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3.5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Lifetime Sales</p>
          <p className="text-xl font-bold text-emerald-400 mt-0.5">{format(totalSpentAll)}</p>
        </div>
      </div>

      {/* TAB 1: CUSTOMERS & CREDIT ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-3">
          {/* Controls: Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700 flex-shrink-0">
              <button
                type="button"
                onClick={() => setAccountFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  accountFilter === 'all'
                    ? 'bg-[#efaa9b] text-[#45150b]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({mergedCustomers.length})
              </button>
              <button
                type="button"
                onClick={() => setAccountFilter('debtors')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  accountFilter === 'debtors'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚠️ Owes Debt ({debtorsCount})
              </button>
              <button
                type="button"
                onClick={() => setAccountFilter('cleared')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  accountFilter === 'cleared'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Zero Balance
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by customer name, phone, type..."
                className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#efaa9b]"
              />
            </div>
          </div>

          {/* Customers Cards & Detailed Sales List */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#efaa9b] border-t-transparent rounded-full animate-spin" />
              <span>Loading customer accounts...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Users className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-sm font-medium">No customer accounts found.</p>
              <p className="text-xs">
                When you make a sale on store credit or add a VIP customer, their details, sales dates, and receipts appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map(cust => {
                const owesMoney = (cust.balanceOwed || 0) > 0;
                const isExpanded = expandedCustomerId === cust.id;
                const latestSale = cust.sales[0];

                return (
                  <div
                    key={cust.id}
                    className={`bg-slate-900/70 border rounded-2xl p-4 transition-all ${
                      owesMoney ? 'border-amber-500/50 bg-amber-950/10' : 'border-slate-700/80'
                    }`}
                  >
                    {/* Top Row: Customer Info & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          owesMoney ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-[#efaa9b]'
                        }`}>
                          {(cust.name || 'C')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-white text-sm">{cust.name}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                              {cust.customerType || 'VIP Client'}
                            </span>
                            {!cust.isRegistered && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 border border-blue-700/50 text-blue-300">
                                Auto-linked from POS
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                            {cust.phone ? (
                              <span className="font-mono text-slate-300 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#efaa9b]" />
                                {cust.phone}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">No phone on file</span>
                            )}

                            {cust.lastSaleDate && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                Last Sale: <strong className="text-slate-200">{formatSaleDate(cust.lastSaleDate)}</strong>
                              </span>
                            )}

                            <span className="text-[11px] text-slate-500">
                              {cust.sales.length} purchase{cust.sales.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Balances & Primary Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Balance Owed</p>
                          <p className={`text-base font-bold font-mono ${owesMoney ? 'text-red-400' : 'text-emerald-400'}`}>
                            {owesMoney ? format(cust.balanceOwed) : 'Clear ($0.00)'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {owesMoney && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(cust);
                                setPaymentAmount(String(cust.balanceOwed));
                                setPaymentModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow flex items-center gap-1"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Pay Debt</span>
                            </button>
                          )}

                          {cust.phone && (
                            <button
                              type="button"
                              onClick={() => handleWhatsAppCustomer(cust)}
                              className="p-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 transition-colors"
                              title="Send WhatsApp balance reminder"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {cust.isRegistered && (
                            <button
                              type="button"
                              onClick={() => openEditModal(cust)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors"
                              title="Edit account details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Expand/Collapse Purchases */}
                          {cust.sales.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedCustomerId(isExpanded ? null : cust.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-300 transition-colors"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#efaa9b]" />
                              <span>{isExpanded ? 'Hide' : 'Receipts'} ({cust.sales.length})</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Latest Receipt Pill (if collapsed) */}
                    {!isExpanded && latestSale && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1 truncate text-[11px]">
                          <Clock className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span>Latest Sale: {formatSaleDate(latestSale.timestamp)}</span>
                          <span className="text-slate-500">·</span>
                          <span className="font-bold text-white">${Number(latestSale.total || 0).toFixed(2)}</span>
                          {(latestSale.balanceOwed || 0) > 0 && (
                            <span className="text-amber-400 font-semibold ml-1">
                              (Owes ${Number(latestSale.balanceOwed).toFixed(2)})
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(latestSale)}
                          className="text-[11px] font-bold text-[#efaa9b] hover:text-[#f3c2b7] underline flex items-center gap-1 flex-shrink-0 ml-2"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>View Receipt Copy</span>
                        </button>
                      </div>
                    )}

                    {/* Expanded Sales & Receipts Table */}
                    {isExpanded && cust.sales.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 animate-fade-in">
                        <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-[#efaa9b]" />
                          <span>Complete Purchases & Receipts History for {cust.name}:</span>
                        </p>
                        <div className="overflow-x-auto rounded-xl border border-slate-700">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-800 text-slate-400 border-b border-slate-700">
                                <th className="text-left px-3 py-2">Receipt #</th>
                                <th className="text-left px-3 py-2">Date & Time</th>
                                <th className="text-left px-3 py-2">Payment</th>
                                <th className="text-right px-3 py-2">Total ($)</th>
                                <th className="text-right px-3 py-2">Paid ($)</th>
                                <th className="text-right px-3 py-2">Balance Due</th>
                                <th className="text-center px-3 py-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cust.sales.map(sale => {
                                const isSaleCredit = (sale.balanceOwed || 0) > 0;
                                return (
                                  <tr key={sale.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                                    <td className="px-3 py-2 font-mono font-bold text-white">
                                      #{sale.receiptNo || sale.id?.slice(-6).toUpperCase()}
                                    </td>
                                    <td className="px-3 py-2 text-slate-300">
                                      {formatSaleDate(sale.timestamp)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-400">
                                      {sale.paymentMethod || 'Cash'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-bold text-white">
                                      ${Number(sale.total || 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-300">
                                      ${Number(sale.amountPaid || 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-bold">
                                      {isSaleCredit ? (
                                        <span className="text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                                          ${Number(sale.balanceOwed).toFixed(2)}
                                        </span>
                                      ) : (
                                        <span className="text-emerald-400">Paid ($0.00)</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReceipt(sale)}
                                        className="px-2.5 py-1 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow"
                                      >
                                        <Receipt className="w-3 h-3" />
                                        <span>Receipt Copy</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL STORE RECEIPTS & DISPUTES LOG */}
      {activeTab === 'receipts' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 space-y-3">
          {/* Controls: Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700 flex-shrink-0">
              <button
                type="button"
                onClick={() => setReceiptFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  receiptFilter === 'all'
                    ? 'bg-[#efaa9b] text-[#45150b]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Receipts ({salesList.length})
              </button>
              <button
                type="button"
                onClick={() => setReceiptFilter('credit')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  receiptFilter === 'credit'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚠️ Credit Due ({salesList.filter(s => (s.balanceOwed || 0) > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setReceiptFilter('paid')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  receiptFilter === 'paid'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Paid in Full ({salesList.filter(s => !(s.balanceOwed > 0)).length})
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
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

          {/* Receipts Table */}
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#efaa9b] border-t-transparent rounded-full animate-spin" />
              <span>Loading receipts archive...</span>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <Receipt className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-sm font-medium">No sales receipts match this filter.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSales.map(sale => {
                const isCreditOwed = (sale.balanceOwed || 0) > 0;
                const itemCount = (sale.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);

                return (
                  <div
                    key={sale.id}
                    className={`bg-slate-900/70 border rounded-xl p-3 transition-all hover:border-slate-500 ${
                      isCreditOwed ? 'border-amber-500/60 bg-amber-950/10' : 'border-slate-700'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-white">
                          #{sale.receiptNo || sale.id?.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formatSaleDate(sale.timestamp)}
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
                            <CheckCircle className="w-3 h-3" />
                            Paid
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer & Breakdown */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-t border-slate-800/80 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#efaa9b]" />
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
                            Paid: ${Number(sale.amountPaid || 0).toFixed(2)} · Due: ${Number(sale.balanceOwed).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 mt-1.5">
                      <span className="text-[10px] text-slate-500">
                        Cashier: {sale.cashierName || 'Staff'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(sale)}
                          className="px-3 py-1 rounded-lg bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] text-[11px] font-bold transition-colors flex items-center gap-1 shadow"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>View Receipt Copy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editCustomer ? `Edit Account — ${editCustomer.name}` : 'Register New Customer / VIP Account'}
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              form="customer-account-form"
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-bold transition-colors shadow-md shadow-[#efaa9b]/20"
            >
              {saving ? 'Saving...' : editCustomer ? 'Save Changes' : 'Register Account'}
            </button>
          </div>
        }
      >
        <form id="customer-account-form" onSubmit={handleSaveCustomer} className="space-y-3.5">
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 p-2.5 rounded-xl">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Customer / Account Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Jessica Doe / VIP Client"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number (WhatsApp)
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 0770123456"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Client Category
              </label>
              <select
                value={customerType}
                onChange={e => setCustomerType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
              >
                {CUSTOMER_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Store Credit Limit ($ USD)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              value={creditLimit}
              onChange={e => setCreditLimit(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Maximum store credit allowance for this customer.
            </span>
          </div>
        </form>
      </Modal>

      {/* Receive Debt Payment Modal */}
      {paymentModalOpen && selectedCustomer && (
        <Modal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title={`Receive Debt Payment — ${selectedCustomer.name}`}
          size="sm"
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                form="customer-payment-form"
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                {saving ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          }
        >
          <form id="customer-payment-form" onSubmit={handleRecordPayment} className="space-y-3">
            <div className="bg-slate-900/40 border border-slate-700 p-3 rounded-xl">
              <p className="text-[11px] text-slate-400">Total Outstanding Debt:</p>
              <p className="text-lg font-bold text-red-400">{format(selectedCustomer.balanceOwed || 0)}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Payment Amount ($ USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedCustomer.balanceOwed}
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Payment Method / Note
              </label>
              <input
                type="text"
                value={paymentNote}
                onChange={e => setPaymentNote(e.target.value)}
                placeholder="e.g. Cash at counter / Mobile Money"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Embedded Thermal Printable Receipt Modal */}
      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        sale={viewingSale}
      />
    </div>
  );
}
