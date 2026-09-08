import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../contexts/AppContext';
import {
  Search, ShoppingBag, MessageCircle, MapPin, Phone,
  Sparkles, Check, ChevronRight, X, ArrowUpRight, ShieldCheck,
  Truck, Plus, Minus, Trash2, ArrowRight, CheckCircle2
} from 'lucide-react';

export const CATEGORIES = [
  { id: 'All', label: 'ALL' },
  { id: 'Perfume', label: 'PERFUME' },
  { id: 'Hair', label: 'HAIR' },
  { id: 'Body Lotion', label: 'BODY LOTION' },
  { id: 'Body Oil', label: 'BODY OIL' },
  { id: 'Other Products', label: 'OTHER PRODUCTS' },
];

export function getProductPrimaryCategory(product) {
  const cat = (product.category || product.type || '').trim().toLowerCase();
  if (cat.includes('perfume') || cat.includes('fragrance') || cat.includes('cologne')) return 'Perfume';
  if (cat.includes('hair')) return 'Hair';
  if (cat.includes('body lotion') || (cat.includes('lotion') && !cat.includes('oil'))) return 'Body Lotion';
  if (cat.includes('body oil') || (cat.includes('oil') && !cat.includes('hair') && !cat.includes('lotion'))) return 'Body Oil';
  return 'Other Products';
}

function cleanWhatsAppPhone(phone) {
  let cleaned = (phone || '0778433270').replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '231' + cleaned.slice(1);
  } else if (!cleaned.startsWith('231')) {
    cleaned = '231' + cleaned;
  }
  return cleaned || '231778433270';
}

export default function CustomerCatalog({ onGoToLogin }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSubCategory, setActiveSubCategory] = useState('All');
  const { exchangeRate, storeSettings } = useApp();

  // Multi-item Shopping Cart with localStorage persistence
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('jam_beauty_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isBagOpen, setIsBagOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);

  // Dynamic store configuration from CMS (or defaults)
  const businessWhatsApp = storeSettings?.whatsappNumber || '0778433270';
  const displayPhone = storeSettings?.storePhone || businessWhatsApp;
  const storeLocation = storeSettings?.storeLocation || storeSettings?.address || 'Monrovia, Liberia';
  const heroLabel = storeSettings?.heroLabel || 'NEW SEASON';
  const heroTitle = storeSettings?.heroTitle || 'Beauty essentials, delivered in Monrovia';
  const heroSubtitle = storeSettings?.heroSubtitle || 'Authentic skincare and fragrance, hand-picked for Liberian skin.';
  const deliveryNote = storeSettings?.deliveryNote || 'Same-Day Monrovia Rider Delivery';
  const storeHours = storeSettings?.storeHours || 'Mon - Sat: 8:30 AM - 6:30 PM';

  useEffect(() => {
    return onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn('Products listener notice:', err.message || err);
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('jam_beauty_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Could not save cart to localStorage', e);
    }
  }, [cart]);

  // Cart operations
  const addToCart = (product) => {
    setCart(prev => {
      const pId = product.id || product.barcode;
      const existing = prev.find(item => (item.product.id || item.product.barcode) === pId);
      if (existing) {
        return prev.map(item =>
          (item.product.id || item.product.barcode) === pId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (pId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(pId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        (item.product.id || item.product.barcode) === pId
          ? { ...item, quantity: newQty }
          : item
      )
    );
  };

  const removeFromCart = (pId) => {
    setCart(prev => prev.filter(item => (item.product.id || item.product.barcode) !== pId));
  };

  const clearCart = () => setCart([]);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartUSD = cart.reduce((sum, item) => sum + (Number(item.product.retailPrice || 0) * item.quantity), 0);
  const totalCartLRD = (totalCartUSD * (exchangeRate || 197)).toLocaleString(undefined, { maximumFractionDigits: 0 });

  // Dynamically extract all distinct types/categories for products grouped under "Other Products"
  const otherSubCategories = React.useMemo(() => {
    const map = new Map();
    products.forEach(p => {
      if (getProductPrimaryCategory(p) === 'Other Products') {
        let sub = (p.category || p.type || '').trim();
        if (!sub || sub.toLowerCase() === 'other' || sub.toLowerCase() === 'other products') {
          sub = 'General';
        } else {
          sub = sub.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
        map.set(sub, (map.get(sub) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  // Filtering products
  const filtered = products.filter(p => {
    const primaryCat = getProductPrimaryCategory(p);

    if (activeCategory !== 'All') {
      if (activeCategory === 'Other Products') {
        if (primaryCat !== 'Other Products') return false;
        if (activeSubCategory !== 'All') {
          let pSub = (p.category || p.type || '').trim();
          if (!pSub || pSub.toLowerCase() === 'other' || pSub.toLowerCase() === 'other products') {
            pSub = 'General';
          }
          if (pSub.toLowerCase() !== activeSubCategory.toLowerCase()) return false;
        }
      } else {
        if (primaryCat !== activeCategory) return false;
      }
    }

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  });

  // Handle final WhatsApp Checkout
  const handleCompleteWhatsAppOrder = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError('Please enter your local contact cell phone number.');
      return;
    }
    if (!deliveryLocation.trim()) {
      setFormError('Please enter your delivery location/address in Monrovia.');
      return;
    }
    if (cart.length === 0) {
      setFormError('Your cart is empty.');
      return;
    }

    // Build the clean WhatsApp message
    let itemsText = cart.map((item, idx) => {
      const p = item.product;
      const unitUSD = Number(p.retailPrice || 0).toFixed(2);
      const lineUSD = (Number(p.retailPrice || 0) * item.quantity).toFixed(2);
      return `${idx + 1}. *${p.name}* (Qty: ${item.quantity}) - $${lineUSD} USD`;
    }).join('\n');

    const message = [
      `✨ *NEW ORDER - JAM BEAUTY STORE* ✨`,
      `---------------------------------`,
      `👤 *Customer Name:* ${customerName.trim()}`,
      `📞 *Contact Phone:* ${customerPhone.trim()}`,
      `📍 *Delivery Location:* ${deliveryLocation.trim()}`,
      orderNotes.trim() ? `📝 *Special Notes:* ${orderNotes.trim()}` : null,
      ``,
      `🛍️ *ITEMS ORDERED (${totalCartCount} pcs):*`,
      itemsText,
      ``,
      `💰 *ORDER TOTAL:* $${totalCartUSD.toFixed(2)} USD (approx. L$${totalCartLRD} LRD)`,
      `---------------------------------`,
      `Please confirm my order and let me know when the delivery rider departs!`
    ].filter(Boolean).join('\n');

    // Save online order record into Firestore for store manager tracking
    try {
      await addDoc(collection(db, 'onlineOrders'), {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryLocation: deliveryLocation.trim(),
        orderNotes: orderNotes.trim(),
        items: cart.map(i => ({
          productId: i.product.id || i.product.barcode,
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: Number(i.product.retailPrice || 0),
          total: Number(i.product.retailPrice || 0) * i.quantity,
        })),
        totalUSD: totalCartUSD,
        totalLRD: Number(totalCartUSD * (exchangeRate || 197)),
        exchangeRate: exchangeRate || 197,
        status: 'pending_whatsapp',
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Order logging notice:', err);
    }

    const waPhone = cleanWhatsAppPhone(businessWhatsApp);
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp
    window.open(waUrl, '_blank');
    setOrderSubmitted(true);
    clearCart();
  };

  const scrollToCatalog = () => {
    const el = document.getElementById('catalog-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#292524] font-sans antialiased flex flex-col selection:bg-[#efaa9b]/30">
      
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#f0ebe4] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          
          {/* Left: Search Bar */}
          <div className="w-44 sm:w-80 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search skincare, fragrance, makeup..."
              className="w-full bg-[#f6f3ee] border border-transparent focus:border-[#efaa9b] rounded-full pl-9 pr-8 py-1.5 sm:py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:bg-white transition-all shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Center: Logo */}
          <div className="text-center flex-shrink-0 cursor-pointer" onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}>
            <div className="flex items-center justify-center gap-2">
              <img
                src="/jam-logo-blush.jpg"
                alt="JAM Beauty"
                className="w-7 h-7 rounded-full object-cover border border-[#efaa9b]/40 shadow-sm"
              />
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-[0.2em] text-[#3b1912] uppercase">
                JAM
              </span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.35em] text-[#8c655d] font-medium block -mt-0.5">
              BEAUTY STORE
            </span>
          </div>

          {/* Right: Cart Button & Staff Portal */}
          <div className="flex items-center gap-2 sm:gap-3 justify-end">
            <a
              href={`https://wa.me/${cleanWhatsAppPhone(businessWhatsApp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 rounded-full text-xs font-semibold transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              <span>{businessWhatsApp}</span>
            </a>

            {/* Shopping Bag Button with Live Item Count */}
            <button
              type="button"
              onClick={() => setIsBagOpen(true)}
              className="relative p-2 text-stone-700 hover:text-[#45150b] transition-colors flex items-center gap-1"
              title="View Shopping Bag"
            >
              <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
              {totalCartCount > 0 ? (
                <span className="w-5 h-5 bg-[#df9487] text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-sm">
                  {totalCartCount}
                </span>
              ) : (
                <span className="hidden sm:inline text-xs text-stone-500 font-medium">Bag</span>
              )}
            </button>

            {onGoToLogin && (
              <button
                type="button"
                onClick={onGoToLogin}
                className="text-[11px] font-semibold text-stone-500 hover:text-[#45150b] border border-stone-300 hover:border-[#efaa9b] px-2.5 py-1 rounded-full transition-colors hidden sm:block"
              >
                Staff Portal
              </button>
            )}
          </div>
        </div>

        {/* 2. CATEGORY NAVIGATION SUBHEADER */}
        <div className="border-t border-[#f2ece4] bg-white shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 overflow-x-auto no-scrollbar scrollbar-none py-2.5 sm:py-3 flex items-center justify-start md:justify-center gap-5 sm:gap-8">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setActiveSubCategory('All');
                  scrollToCatalog();
                }}
                className={`text-[12px] sm:text-[11px] font-semibold tracking-[0.14em] sm:tracking-[0.18em] transition-all whitespace-nowrap pb-1 border-b-2 flex-shrink-0 ${
                  activeCategory === cat.id
                    ? 'border-[#45150b] text-[#45150b] font-bold'
                    : 'border-transparent text-stone-500 hover:text-stone-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sub-categories bar for Other Products (Dynamically populated from uploaded spreadsheet categories) */}
          {activeCategory === 'Other Products' && otherSubCategories.length > 0 && (
            <div className="bg-[#fcfaf7] border-t border-[#ede6dc] py-2.5 px-4 sm:px-8 shadow-inner">
              <div className="max-w-7xl mx-auto flex items-center justify-start gap-2 overflow-x-auto no-scrollbar scrollbar-none">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mr-1 flex-shrink-0 flex items-center gap-1">
                  <span>Type:</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubCategory('All');
                    scrollToCatalog();
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                    activeSubCategory === 'All'
                      ? 'bg-[#45150b] text-white shadow-sm ring-2 ring-[#45150b]/20'
                      : 'bg-white text-stone-700 border border-stone-300 hover:border-[#df9487] hover:text-[#45150b]'
                  }`}
                >
                  All ({products.filter(p => getProductPrimaryCategory(p) === 'Other Products').length})
                </button>
                {otherSubCategories.map(sub => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => {
                      setActiveSubCategory(sub.name);
                      scrollToCatalog();
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                      activeSubCategory.toLowerCase() === sub.name.toLowerCase()
                        ? 'bg-[#45150b] text-white shadow-sm ring-2 ring-[#45150b]/20'
                        : 'bg-white text-stone-700 border border-stone-300 hover:border-[#df9487] hover:text-[#45150b]'
                    }`}
                  >
                    {sub.name} ({sub.count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 3. HERO BANNER (Editable from CMS) */}
      <section className="relative overflow-hidden bg-[#f7f2eb] border-b border-[#ede6dc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20 flex flex-col md:flex-row items-center justify-between gap-8 sm:gap-12">
          
          <div className="max-w-xl text-left space-y-4 sm:space-y-6">
            <span className="text-[11px] uppercase tracking-[0.25em] font-semibold text-stone-500 block">
              {heroLabel}
            </span>
            
            <h2 className="font-serif text-4xl sm:text-6xl text-[#292220] font-normal leading-[1.08] tracking-tight">
              {heroTitle}
            </h2>
            
            <p className="text-sm sm:text-base text-stone-600 font-normal leading-relaxed max-w-md">
              {heroSubtitle}
            </p>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="px-6 py-3.5 bg-[#df9487] hover:bg-[#d48476] text-white text-xs uppercase tracking-[0.18em] font-bold rounded shadow-md shadow-[#df9487]/25 transition-all active:scale-98"
              >
                SHOP THE CATALOG
              </button>
              
              <button
                type="button"
                onClick={() => setIsBagOpen(true)}
                className="px-4 py-3.5 text-stone-700 hover:text-[#45150b] text-xs uppercase tracking-[0.15em] font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>View Bag ({totalCartCount})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#df9487]" />
                <span>100% Authentic Products</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#df9487]" />
                <span>{deliveryNote}</span>
              </div>
            </div>
          </div>

          {/* Right Hero Badge */}
          <div className="relative w-full md:w-1/2 max-w-md aspect-[4/3] sm:aspect-square flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#efaa9b]/25 via-white/50 to-[#efaa9b]/10 rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative z-10 w-full h-full rounded-2xl overflow-hidden border border-[#ede3d7] bg-white/70 shadow-xl flex items-center justify-center p-6 text-center">
              <div className="space-y-3">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#efaa9b]/30 to-[#45150b]/10 flex items-center justify-center p-1.5 border border-[#efaa9b]/40 shadow-inner">
                  <img src="/jam-logo-blush.jpg" alt="JAM Beauty" className="w-full h-full rounded-full object-cover" />
                </div>
                <h3 className="font-serif text-2xl text-[#3a1d17] font-semibold">JAM Beauty Store</h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                  Fine Fragrances, Luxury Cosmetics, High-Grade Hair & Body Treatments
                </p>
                <div className="pt-2 flex justify-center gap-2 text-[10px] font-bold tracking-wider text-[#45150b]">
                  <span className="bg-[#efaa9b]/20 px-2.5 py-1 rounded-full uppercase">{storeLocation}</span>
                  <span className="bg-stone-100 px-2.5 py-1 rounded-full">USD & LRD ACCEPTED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. "SHOP BY CATEGORY" SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10 w-full">
        <div className="flex items-baseline justify-between mb-6">
          <h3 className="font-serif text-2xl sm:text-3xl text-stone-900 font-normal">
            Shop by category
          </h3>
          <button
            type="button"
            onClick={() => { setActiveCategory('All'); scrollToCatalog(); }}
            className="text-xs font-semibold text-[#8c655d] hover:text-[#45150b] uppercase tracking-wider flex items-center gap-1"
          >
            <span>View All ({products.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {[
            { id: 'Perfume', title: 'Perfume', subtitle: 'Luxury Fragrance' },
            { id: 'Hair', title: 'Hair', subtitle: 'Bundles & Care' },
            { id: 'Body Lotion', title: 'Body Lotion', subtitle: 'Silky Moisture' },
            { id: 'Body Oil', title: 'Body Oil', subtitle: 'Scented Glow' },
            { id: 'Other Products', title: 'Other Products', subtitle: 'Explore All Categories' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setActiveSubCategory('All');
                scrollToCatalog();
              }}
              className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                activeCategory === cat.id
                  ? 'bg-white border-[#45150b] shadow-md ring-1 ring-[#45150b]/20'
                  : 'bg-white/80 hover:bg-white border-[#eee7de] hover:border-[#df9487] shadow-sm'
              }`}
            >
              <div>
                <p className="font-serif text-base text-stone-900 font-medium group-hover:text-[#45150b] transition-colors">
                  {cat.title}
                </p>
                <p className="text-[10px] text-stone-500 mt-0.5">{cat.subtitle}</p>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-[#df9487]">
                <span>Browse</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 5. LIVE PRODUCTS CATALOG GRID WITH "ADD TO BAG" */}
      <section id="catalog-grid" className="max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full flex-1">
        
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee7de] pb-4 mb-6">
          <div>
            <h4 className="font-serif text-xl text-stone-900">
              {activeCategory === 'All'
                ? 'All Beauty Essentials'
                : activeCategory === 'Other Products'
                  ? (activeSubCategory === 'All' ? 'Other Products' : `Other Products · ${activeSubCategory}`)
                  : activeCategory}
            </h4>
            <p className="text-xs text-stone-500 mt-0.5">
              {filtered.length} product{filtered.length !== 1 ? 's' : ''} available · Exchange Rate: 1 USD = {exchangeRate} LRD
            </p>
          </div>

          {searchTerm && (
            <div className="inline-flex items-center gap-1.5 bg-[#efaa9b]/20 border border-[#efaa9b]/40 px-3 py-1 rounded-full text-xs text-[#45150b]">
              <span>Results for "{searchTerm}"</span>
              <button onClick={() => setSearchTerm('')}><X className="w-3 h-3" /></button>
            </div>
          )}
        </div>

        {/* Dynamic subcategory pills directly above grid when viewing Other Products */}
        {activeCategory === 'Other Products' && otherSubCategories.length > 0 && (
          <div className="bg-white border border-[#ede6dc] rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#45150b] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#df9487]" />
                <span>Filter Other Products By Category:</span>
              </span>
              <span className="text-xs text-stone-500 font-medium">
                {activeSubCategory === 'All' ? 'Showing All Types' : `Active: ${activeSubCategory}`}
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none pb-1">
              <button
                type="button"
                onClick={() => setActiveSubCategory('All')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                  activeSubCategory === 'All'
                    ? 'bg-[#45150b] text-white shadow-sm ring-2 ring-[#45150b]/20'
                    : 'bg-stone-50 text-stone-700 border border-stone-300 hover:border-[#df9487] hover:text-[#45150b]'
                }`}
              >
                All ({products.filter(p => getProductPrimaryCategory(p) === 'Other Products').length})
              </button>
              {otherSubCategories.map(sub => (
                <button
                  key={sub.name}
                  type="button"
                  onClick={() => setActiveSubCategory(sub.name)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                    activeSubCategory.toLowerCase() === sub.name.toLowerCase()
                      ? 'bg-[#45150b] text-white shadow-sm ring-2 ring-[#45150b]/20'
                      : 'bg-stone-50 text-stone-700 border border-stone-300 hover:border-[#df9487] hover:text-[#45150b]'
                  }`}
                >
                  {sub.name} ({sub.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#df9487] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-stone-500">Loading catalog items...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map(product => {
              const usd = Number(product.retailPrice || 0).toFixed(2);
              const lrd = (Number(product.retailPrice || 0) * (exchangeRate || 197)).toLocaleString(undefined, { maximumFractionDigits: 0 });
              const inStock = (product.showroomQty || 0) > 0;
              const pId = product.id || product.barcode;
              const itemInCart = cart.find(i => (i.product.id || i.product.barcode) === pId);

              return (
                <div
                  key={pId}
                  className="bg-white rounded-xl border border-[#eee7de] hover:border-[#df9487]/60 overflow-hidden flex flex-col justify-between transition-all hover:shadow-lg group"
                >
                  {/* Photo area */}
                  <div className="relative aspect-square bg-[#f8f5f0] overflow-hidden flex items-center justify-center">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 bg-[#fbf9f6]">
                        <ShoppingBag className="w-10 h-10 stroke-1 text-stone-400" />
                        <span className="text-[10px] tracking-wider uppercase font-semibold text-stone-400 mt-1">JAM Beauty</span>
                      </div>
                    )}

                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {inStock ? 'In Stock' : 'Order on Req'}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-white/80 backdrop-blur-sm text-stone-600">
                        {product.category || 'Beauty'}
                      </span>
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h5 className="font-medium text-xs sm:text-sm text-stone-900 line-clamp-2 leading-snug group-hover:text-[#45150b] transition-colors">
                        {product.name}
                      </h5>
                      {product.barcode && (
                        <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                          Code: {product.barcode}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#f4efe8]">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-base sm:text-lg font-bold text-stone-900">
                          ${usd}
                        </span>
                        <span className="text-xs font-medium text-stone-500">
                          L${lrd}
                        </span>
                      </div>

                      {/* Multi-item Bag Controls */}
                      {itemInCart ? (
                        <div className="flex items-center justify-between bg-[#fbf5f4] border border-[#efaa9b]/60 rounded-lg p-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(pId, itemInCart.quantity - 1)}
                            className="w-7 h-7 bg-white hover:bg-[#efaa9b] hover:text-white rounded text-stone-700 flex items-center justify-center transition-colors shadow-sm"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-extrabold text-[#45150b]">
                            {itemInCart.quantity} in Bag
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(pId, itemInCart.quantity + 1)}
                            className="w-7 h-7 bg-white hover:bg-[#efaa9b] hover:text-white rounded text-stone-700 flex items-center justify-center transition-colors shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="w-full py-2 px-2.5 bg-[#df9487] hover:bg-[#d48476] text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Add to Bag</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-[#eee7de] p-8 space-y-2">
            <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
            <h5 className="font-serif text-lg text-stone-800">No items found</h5>
            <p className="text-xs text-stone-500">
              We couldn't find any products in "{activeSubCategory !== 'All' ? activeSubCategory : activeCategory}". Try clearing your search.
            </p>
          </div>
        )}
      </section>

      {/* 6. STORE FOOTER */}
      <footer className="bg-white border-t border-[#eee7de] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-stone-600">
          <div>
            <span className="font-serif text-lg font-bold tracking-widest text-[#45150b]">JAM BEAUTY STORE</span>
            <p className="text-stone-500 leading-relaxed max-w-sm mt-2">
              Your premier boutique in Monrovia for original French & Arabian perfumery, luxury cosmetics, and salon-grade haircare.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">Location & Delivery</p>
            <p className="flex items-center gap-1.5 text-stone-600">
              <MapPin className="w-3.5 h-3.5 text-[#df9487] flex-shrink-0" />
              <span>{storeLocation}</span>
            </p>
            <p className="flex items-center gap-1.5 text-stone-600">
              <Phone className="w-3.5 h-3.5 text-[#df9487] flex-shrink-0" />
              <span>Hotline & WhatsApp: {displayPhone}</span>
            </p>
            <p className="text-stone-500 text-[11px] pt-1">
              Store Hours: {storeHours}
            </p>
          </div>

          <div className="space-y-2 md:text-right">
            <p className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">Staff Management Portal</p>
            <p className="text-stone-500">
              Cashiers & Managers access POS, Inventory & Reports:
            </p>
            {onGoToLogin && (
              <button
                type="button"
                onClick={onGoToLogin}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Access Staff Portal
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-[#f4efe8] py-4 px-4 text-center text-[11px] text-stone-400">
          JAM Beauty Store &copy; {new Date().getFullYear()} · jambeautystore.com · All Rights Reserved
        </div>
      </footer>

      {/* 7. FLOATING ACTION BUTTONS */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2.5">
        {/* Floating Bag button */}
        <button
          type="button"
          onClick={() => setIsBagOpen(true)}
          className="relative w-12 h-12 rounded-full bg-[#df9487] hover:bg-[#d48476] text-white flex items-center justify-center shadow-lg shadow-[#df9487]/30 transition-transform active:scale-95"
          title="Open Shopping Bag"
        >
          <ShoppingBag className="w-5 h-5 stroke-[2]" />
          {totalCartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#45150b] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow">
              {totalCartCount}
            </span>
          )}
        </button>

        {/* Floating WhatsApp button */}
        <a
          href={`https://wa.me/${cleanWhatsAppPhone(businessWhatsApp)}?text=${encodeURIComponent("Hello JAM Beauty Store! I am browsing your online catalog at jambeautystore.com and have a question.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white flex items-center justify-center shadow-lg shadow-[#25D366]/30 transition-transform active:scale-95"
          title="Direct WhatsApp"
        >
          <MessageCircle className="w-6 h-6 fill-current" />
        </a>
      </div>

      {/* 8. SHOPPING BAG SLIDE-OVER DRAWER WITH CUSTOMER DELIVERY FORM */}
      {isBagOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsBagOpen(false)} />
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-[#faf8f5]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#df9487]" />
                <h3 className="font-serif text-lg font-bold text-stone-900">Your Beauty Bag</h3>
                <span className="text-xs bg-[#efaa9b]/30 text-[#45150b] px-2 py-0.5 rounded-full font-bold">
                  {totalCartCount} item{totalCartCount !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => setIsBagOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto" />
                  <h4 className="font-serif text-lg text-stone-700">Your bag is empty</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto">
                    Browse our perfumes, haircare, and cosmetics and tap "Add to Bag" to get started.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setIsBagOpen(false); scrollToCatalog(); }}
                    className="px-5 py-2.5 bg-[#df9487] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <>
                  {/* Cart Items List */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-semibold text-stone-500 uppercase tracking-wider pb-1 border-b border-stone-100">
                      <span>Selected Items</span>
                      <button onClick={clearCart} className="text-red-500 hover:underline normal-case">Clear bag</button>
                    </div>

                    <div className="space-y-2.5">
                      {cart.map(item => {
                        const p = item.product;
                        const pId = p.id || p.barcode;
                        const lineTotal = (Number(p.retailPrice || 0) * item.quantity).toFixed(2);

                        return (
                          <div key={pId} className="flex gap-3 p-2.5 rounded-xl border border-stone-200 bg-[#fdfcfb]">
                            {/* Image */}
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                            ) : (
                              <div className="w-14 h-14 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400 flex-shrink-0">
                                <ShoppingBag className="w-6 h-6" />
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div className="flex justify-between items-start gap-1">
                                <h5 className="font-medium text-xs text-stone-900 line-clamp-1">{p.name}</h5>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(pId)}
                                  className="text-stone-400 hover:text-red-500 p-0.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <p className="text-[11px] text-stone-500">${Number(p.retailPrice || 0).toFixed(2)} each</p>

                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-2 bg-white border border-stone-300 rounded-lg px-2 py-0.5">
                                  <button onClick={() => updateQuantity(pId, item.quantity - 1)} className="text-stone-500 hover:text-stone-900">
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-xs font-bold text-stone-900 w-4 text-center">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(pId, item.quantity + 1)} className="text-stone-500 hover:text-stone-900">
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className="font-bold text-xs text-stone-900">${lineTotal} USD</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cart Total Box */}
                  <div className="p-3.5 bg-[#fbf5f4] rounded-xl border border-[#efaa9b]/40 space-y-1 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>Total Items:</span>
                      <span className="font-bold text-stone-900">{totalCartCount}</span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-[#45150b] pt-1 border-t border-[#efaa9b]/30">
                      <span>Subtotal USD:</span>
                      <span>${totalCartUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-600">
                      <span>Approx. in LRD:</span>
                      <span className="font-bold text-stone-800">L${totalCartLRD} LRD</span>
                    </div>
                    <p className="text-[10px] text-stone-500 pt-1">
                      * Monrovia rider delivery fee confirmed upon dispatch.
                    </p>
                  </div>

                  {/* Customer Information & Delivery Form */}
                  <form onSubmit={handleCompleteWhatsAppOrder} className="space-y-3 pt-2 border-t border-stone-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-sm font-bold text-stone-900">
                        Delivery & Customer Details
                      </h4>
                      <span className="text-[10px] text-[#df9487] font-semibold">Required for Delivery</span>
                    </div>

                    {formError && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                        {formError}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="e.g. Sarah Kollie"
                        required
                        className="w-full bg-[#f8f6f2] border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#df9487] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Contact Cell Phone * (for delivery rider)
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        placeholder="e.g. 0778 000 000 / 088 000 000"
                        required
                        className="w-full bg-[#f8f6f2] border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#df9487] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Delivery Address & Landmark *
                      </label>
                      <input
                        type="text"
                        value={deliveryLocation}
                        onChange={e => setDeliveryLocation(e.target.value)}
                        placeholder="e.g. Sinkor 14th Street, opposite Catholic Hospital"
                        required
                        className="w-full bg-[#f8f6f2] border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#df9487] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Special Instructions / Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={orderNotes}
                        onChange={e => setOrderNotes(e.target.value)}
                        placeholder="e.g. Call before coming, or In-Store Pickup"
                        className="w-full bg-[#f8f6f2] border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#df9487] focus:bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/25 mt-4"
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                      <span>Complete Order on WhatsApp</span>
                    </button>

                    <p className="text-[10px] text-center text-stone-400 mt-1">
                      Directly connects you with JAM Beauty Store WhatsApp ({businessWhatsApp}) with your items pre-filled!
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
