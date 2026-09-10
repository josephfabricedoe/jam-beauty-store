import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  serverTimestamp,
  addDoc 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import CampaignModal from './CampaignModal';
import {
  Sparkles,
  Phone,
  MessageCircle,
  Users,
  Send,
  CheckCircle,
  Circle,
  Search,
  Plus,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Mail,
  AlertCircle,
  Tag,
  Share2,
  Clock,
  Flame,
  Gift,
  Heart
} from 'lucide-react';

export default function MarketingView({ onNavigateToCustomers = null }) {
  const { format } = useCurrency();

  // Active subtab: 'overview' | 'audience' | 'campaigns'
  const [activeTab, setActiveTab] = useState('overview');

  // Firestore live collections
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Audience search & filters
  const [audienceFilter, setAudienceFilter] = useState('all'); // 'all' | 'vip' | 'lapsed' | 'reachable'
  const [audienceSearch, setAudienceSearch] = useState('');

  // Modals & Queue Sender state
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [activeQueue, setActiveQueue] = useState(null); // { campaignTitle, messageBody, list: [], currentIndex: 0 }

  // Subscribe to live collections
  useEffect(() => {
    setLoading(true);

    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn('Marketing customers listener notice:', err);
        setLoading(false);
      }
    );

    const unsubSales = onSnapshot(
      collection(db, 'sales'),
      (snap) => {
        setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn('Marketing sales listener notice:', err);
      }
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn('Marketing products listener notice:', err);
      }
    );

    const unsubCampaigns = onSnapshot(
      collection(db, 'marketingCampaigns'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setCampaigns(list);
      },
      (err) => {
        console.warn('Marketing campaigns listener notice:', err);
      }
    );

    return () => {
      unsubCustomers();
      unsubSales();
      unsubProducts();
      unsubCampaigns();
    };
  }, []);

  // Compute enriched customer data (LTV, last purchase, lapsed status)
  const enrichedCustomers = useMemo(() => {
    const nowMs = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    // Map sales to customer identifiers (id or phone or name)
    const customerStats = {};
    sales.forEach(sale => {
      const key = sale.customerId || (sale.customerPhone ? sale.customerPhone.trim() : null) || (sale.customerName ? sale.customerName.trim().toLowerCase() : null);
      if (!key) return;

      if (!customerStats[key]) {
        customerStats[key] = { totalSpent: 0, orderCount: 0, lastPurchaseTime: 0 };
      }

      const totalVal = Number(sale.total) || 0;
      customerStats[key].totalSpent += totalVal;
      customerStats[key].orderCount += 1;

      const saleTime = sale.createdAt?.seconds ? sale.createdAt.seconds * 1000 : (sale.createdAt ? new Date(sale.createdAt).getTime() : 0);
      if (saleTime > customerStats[key].lastPurchaseTime) {
        customerStats[key].lastPurchaseTime = saleTime;
      }
    });

    return customers.map(cust => {
      const stats = customerStats[cust.id] || 
                    (cust.phone && customerStats[cust.phone.trim()]) || 
                    (cust.name && customerStats[cust.name.trim().toLowerCase()]) || 
                    { totalSpent: 0, orderCount: 0, lastPurchaseTime: 0 };

      const totalSpent = (cust.totalPurchases != null ? Number(cust.totalPurchases) : stats.totalSpent) || 0;
      const orderCount = stats.orderCount || (totalSpent > 0 ? 1 : 0);
      const lastPurchaseTime = stats.lastPurchaseTime;

      const hasPhone = Boolean(cust.phone && cust.phone.replace(/[^0-9]/g, '').length >= 6);
      const hasEmail = Boolean(cust.email && cust.email.includes('@'));

      // Check if lapsed: has purchased in the past but last purchase is older than 90 days, or created >90d ago without purchase
      const createdTime = cust.createdAt?.seconds ? cust.createdAt.seconds * 1000 : 0;
      const isLapsed = lastPurchaseTime > 0 
        ? (nowMs - lastPurchaseTime > ninetyDaysMs)
        : (createdTime > 0 && (nowMs - createdTime > ninetyDaysMs));

      return {
        ...cust,
        totalSpent,
        orderCount,
        lastPurchaseTime,
        isLapsed,
        hasPhone,
        hasEmail,
      };
    });
  }, [customers, sales]);

  // Compute metrics matching tenantvolt.com screenshot
  const metrics = useMemo(() => {
    const totalCount = enrichedCustomers.length;
    if (totalCount === 0) {
      return {
        reachablePercent: '0%',
        whatsappPercent: '0%',
        smsPercent: '0%',
        averageLtv: 0,
        lapsedCount: 0,
        offerRedemptions: sales.length,
      };
    }

    const reachableList = enrichedCustomers.filter(c => c.hasPhone);
    const reachablePct = Math.round((reachableList.length / totalCount) * 100);

    const emailList = enrichedCustomers.filter(c => c.hasEmail);
    const emailPct = Math.round((emailList.length / totalCount) * 100);

    const totalSalesLtv = enrichedCustomers.reduce((acc, c) => acc + c.totalSpent, 0);
    const avgLtv = totalSalesLtv / totalCount;

    const lapsedCount = enrichedCustomers.filter(c => c.isLapsed).length;

    return {
      reachablePercent: `${reachablePct}%`,
      whatsappPercent: `${reachablePct}%`,
      smsPercent: `${reachablePct}%`,
      averageLtv: avgLtv,
      lapsedCount,
      offerRedemptions: sales.length,
    };
  }, [enrichedCustomers, sales]);

  // Outreach readiness items (matching screenshot: 0 of 4 complete)
  const readinessChecklist = useMemo(() => {
    const hasEmails = enrichedCustomers.some(c => c.hasEmail);
    const hasPhones = enrichedCustomers.some(c => c.hasPhone);
    const hasCampaign = campaigns.length > 0;
    const hasVipRewards = enrichedCustomers.some(c => (c.customerType || '').toLowerCase().includes('vip') || (c.creditLimit && Number(c.creditLimit) > 0));

    const items = [
      {
        id: 'emails',
        label: 'Email addresses captured for your members',
        complete: hasEmails,
        actionLabel: hasEmails ? 'Configured' : 'Set up',
        count: enrichedCustomers.filter(c => c.hasEmail).length,
      },
      {
        id: 'phones',
        label: 'Phone numbers captured for SMS / WhatsApp outreach',
        complete: hasPhones,
        actionLabel: hasPhones ? 'Configured' : 'Set up',
        count: enrichedCustomers.filter(c => c.hasPhone).length,
      },
      {
        id: 'campaign',
        label: 'At least one offer or promotion running',
        complete: hasCampaign,
        actionLabel: hasCampaign ? 'Active' : 'Set up',
        count: campaigns.length,
      },
      {
        id: 'rewards',
        label: 'Loyalty & VIP client rewards configured',
        complete: hasVipRewards,
        actionLabel: hasVipRewards ? 'Active' : 'Set up',
        count: enrichedCustomers.filter(c => (c.customerType || '').toLowerCase().includes('vip')).length,
      },
    ];

    const completedCount = items.filter(i => i.complete).length;
    return { items, completedCount };
  }, [enrichedCustomers, campaigns]);

  // Filtered audience list
  const filteredAudience = useMemo(() => {
    return enrichedCustomers.filter(c => {
      if (audienceFilter === 'vip') {
        if (!(c.customerType || '').toLowerCase().includes('vip')) return false;
      } else if (audienceFilter === 'lapsed') {
        if (!c.isLapsed) return false;
      } else if (audienceFilter === 'reachable') {
        if (!c.hasPhone) return false;
      }

      if (audienceSearch.trim()) {
        const query = audienceSearch.toLowerCase();
        const matchName = (c.name || '').toLowerCase().includes(query);
        const matchPhone = (c.phone || '').toLowerCase().includes(query);
        const matchType = (c.customerType || '').toLowerCase().includes(query);
        return matchName || matchPhone || matchType;
      }

      return true;
    });
  }, [enrichedCustomers, audienceFilter, audienceSearch]);

  // Send single WhatsApp message to customer
  const handleOpenSingleWhatsApp = (cust, customMessage = '') => {
    const rawPhone = cust.phone ? cust.phone.replace(/[^0-9]/g, '') : '';
    if (!rawPhone) {
      alert(`No phone number available for ${cust.name || 'this customer'}.`);
      return;
    }

    const phoneWithCode = rawPhone.startsWith('231') ? rawPhone : `231${rawPhone.replace(/^0+/, '')}`;
    const text = customMessage 
      ? customMessage.replace('{name}', cust.name || 'Valued Customer').replace('{store_url}', 'https://jambeautystore.com')
      : `Hello ${cust.name || 'there'}! ✨ Greeting from JAM Beauty Store! Check out our new arrivals and beauty catalog at https://jambeautystore.com 🌸`;

    const url = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Launch broadcast queue
  const handleLaunchQueue = (campaign) => {
    const reachableAudience = (campaign.audience || enrichedCustomers).filter(c => c.hasPhone);
    if (reachableAudience.length === 0) {
      alert('No reachable phone contacts in this audience.');
      return;
    }

    setActiveQueue({
      title: campaign.title,
      messageBody: campaign.messageBody,
      list: reachableAudience,
      currentIndex: 0,
    });
  };

  const handleSendNextInQueue = () => {
    if (!activeQueue) return;
    const currentCust = activeQueue.list[activeQueue.currentIndex];
    if (!currentCust) return;

    handleOpenSingleWhatsApp(currentCust, activeQueue.messageBody);

    if (activeQueue.currentIndex + 1 < activeQueue.list.length) {
      setActiveQueue(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
      }));
    } else {
      alert('Broadcast dispatch complete! You have sent to all customers in this queue.');
      setActiveQueue(null);
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-6xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Marketing</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            WhatsApp Outreach
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsCampaignModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-rose-950/40 transition-all transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New WhatsApp Campaign</span>
        </button>
      </div>

      {/* Broadcast Queue Banner (If actively sending) */}
      {activeQueue && (
        <div className="bg-emerald-950/80 border-2 border-emerald-500 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <Send className="w-4 h-4 animate-pulse" />
              Broadcasting: {activeQueue.title}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Sending to customer{' '}
              <strong className="text-white">
                {activeQueue.currentIndex + 1} of {activeQueue.list.length}
              </strong>
              : <span className="text-emerald-400 font-semibold">{activeQueue.list[activeQueue.currentIndex]?.name}</span> ({activeQueue.list[activeQueue.currentIndex]?.phone})
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveQueue(null)}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs"
            >
              Close Queue
            </button>
            <button
              type="button"
              onClick={handleSendNextInQueue}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow"
            >
              <span>Send WhatsApp & Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3 Metric Cards (Matching tenantvolt.com exact layout and subtitles) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Reachable */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <Mail className="w-4 h-4" />
            <span>Reachable</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {metrics.reachablePercent}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
              {metrics.whatsappPercent} by WhatsApp · {metrics.smsPercent} by SMS
            </div>
          </div>
        </div>

        {/* 2. Average lifetime value */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Average lifetime value</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {format(metrics.averageLtv)}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
              {metrics.offerRedemptions} sales recorded in platform
            </div>
          </div>
        </div>

        {/* 3. Lapsed contacts */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <MessageCircle className="w-4 h-4" />
            <span>Lapsed contacts</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {metrics.lapsedCount}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
              No purchase in over 90 days
            </div>
          </div>
        </div>
      </div>

      {/* Subtabs matching tenantvolt.com screenshot: Overview | Audience N | Campaigns N */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audience')}
          className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'audience'
              ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Audience <span className="ml-1 text-slate-400 font-normal">{enrichedCustomers.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'campaigns'
              ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Campaigns <span className="ml-1 text-slate-400 font-normal">{campaigns.length}</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Outreach readiness card matching screenshot */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-white">Outreach readiness</h2>
              <span className="text-xs text-slate-400 font-medium">
                {readinessChecklist.completedCount} of 4 complete
              </span>
            </div>

            <div className="space-y-3">
              {readinessChecklist.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-800/80"
                >
                  <div className="flex items-start gap-2.5">
                    {item.complete ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-slate-200">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.count > 0 ? `${item.count} recorded in database` : 'None detected yet'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (item.id === 'campaign') {
                        setIsCampaignModalOpen(true);
                      } else {
                        setActiveTab('audience');
                      }
                    }}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex-shrink-0 ${
                      item.complete
                        ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                        : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                    }`}
                  >
                    {item.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Beauty Broadcast Templates */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  Quick WhatsApp Customer Outreach
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Launch proven beauty promotional messages straight to your customers' WhatsApp.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Card 1: New Arrivals */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    New Arrivals & Restock
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Broadcast newest luxury perfume and skincare arrivals with direct catalog link.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(true)}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-medium transition-colors text-center"
                >
                  Use Template
                </button>
              </div>

              {/* Card 2: Weekend Flash Sale */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    Weekend Flash Sale
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Drive quick foot-traffic and online orders with limited-time flash discount copy.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(true)}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-medium transition-colors text-center"
                >
                  Use Template
                </button>
              </div>

              {/* Card 3: Lapsed Customer Re-engagement */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-col justify-between space-y-2">
                <div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" />
                    Lapsed Client Comeback
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Win back {metrics.lapsedCount} inactive contacts with an exclusive store welcome voucher.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('audience');
                    setAudienceFilter('lapsed');
                  }}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-medium transition-colors text-center"
                >
                  View Lapsed ({metrics.lapsedCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIENCE DIRECTORY */}
      {activeTab === 'audience' && (
        <div className="space-y-3">
          {/* Audience Filter & Search */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setAudienceFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  audienceFilter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Contacts ({enrichedCustomers.length})
              </button>

              <button
                type="button"
                onClick={() => setAudienceFilter('reachable')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  audienceFilter === 'reachable'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                WhatsApp Reachable ({enrichedCustomers.filter(c => c.hasPhone).length})
              </button>

              <button
                type="button"
                onClick={() => setAudienceFilter('vip')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  audienceFilter === 'vip'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                VIP Clients ({enrichedCustomers.filter(c => (c.customerType || '').toLowerCase().includes('vip')).length})
              </button>

              <button
                type="button"
                onClick={() => setAudienceFilter('lapsed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  audienceFilter === 'lapsed'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Lapsed Contacts ({metrics.lapsedCount})
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={audienceSearch}
                onChange={(e) => setAudienceSearch(e.target.value)}
                placeholder="Search contact name, phone, or customer type..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Customer Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone / WhatsApp</th>
                    <th className="px-4 py-3">Segment</th>
                    <th className="px-4 py-3 text-right">Total LTV Spend</th>
                    <th className="px-4 py-3 text-center">Orders</th>
                    <th className="px-4 py-3 text-right">Quick WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAudience.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        {loading ? 'Loading customer audience...' : 'No contacts match the current filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAudience.map(c => {
                      const isVip = (c.customerType || '').toLowerCase().includes('vip');

                      return (
                        <tr key={c.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-white">
                            <div className="font-semibold text-white">{c.name || 'Unnamed Client'}</div>
                            {c.email && (
                              <div className="text-[10px] text-slate-400">{c.email}</div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-300">
                            {c.phone ? (
                              <span className="font-mono text-emerald-400 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-500" />
                                {c.phone}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">No phone recorded</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isVip 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : c.isLapsed
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {c.customerType || (c.isLapsed ? 'Lapsed' : 'Regular')}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right font-semibold text-[#efaa9b]">
                            {format(c.totalSpent)}
                          </td>

                          <td className="px-4 py-3 text-center text-slate-300 font-medium">
                            {c.orderCount}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {c.hasPhone ? (
                              <button
                                type="button"
                                onClick={() => handleOpenSingleWhatsApp(c)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Message</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-600">Unreachable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CAMPAIGNS HISTORY */}
      {activeTab === 'campaigns' && (
        <div className="space-y-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Campaigns & Dispatches</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Saved marketing broadcasts and scheduled WhatsApp drops.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCampaignModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Campaign</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {campaigns.length === 0 ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-10 text-center text-slate-500">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-rose-400" />
                <p className="font-semibold text-white">No campaigns created yet</p>
                <p className="text-xs text-slate-400 mt-1">Craft your first promotional broadcast to engage customers on WhatsApp.</p>
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(true)}
                  className="mt-3 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Create Campaign Now
                </button>
              </div>
            ) : (
              campaigns.map(camp => {
                const dateStr = camp.createdAt?.seconds 
                  ? new Date(camp.createdAt.seconds * 1000).toLocaleDateString()
                  : 'Recent';

                return (
                  <div
                    key={camp.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{camp.title}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-rose-300 font-medium border border-slate-700">
                          {camp.targetSegment || 'All'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {camp.messageBody}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-1">
                        Created {dateStr} · Targeted Audience: {camp.audienceCount || 'All'} contacts
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLaunchQueue(camp)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Launch Broadcast</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Campaign Creation Modal */}
      <CampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        onLaunchQueue={handleLaunchQueue}
        customers={enrichedCustomers}
        products={products}
      />
    </div>
  );
}
