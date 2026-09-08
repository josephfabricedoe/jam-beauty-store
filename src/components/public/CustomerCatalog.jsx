import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useApp } from '../../contexts/AppContext';
import {
  Search, ShoppingBag, MessageCircle, MapPin, Phone,
  Sparkles, Check, ChevronRight, X, ArrowUpRight, ShieldCheck, Truck
} from 'lucide-react';

const CATEGORIES = [
  { id: 'All', label: 'ALL' },
  { id: 'Perfume', label: 'PERFUME' },
  { id: 'Hair', label: 'HAIR' },
  { id: 'Skincare', label: 'SKINCARE' },
  { id: 'Body Lotion', label: 'BODY LOTION' },
  { id: 'Body Oil', label: 'BODY OIL' },
  { id: 'Cosmetics', label: 'COSMETICS' },
  { id: 'Accessories', label: 'ACCESSORIES' },
];

export default function CustomerCatalog({ onGoToLogin }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProductModal, setSelectedProductModal] = useState(null);
  const { exchangeRate, storeSettings } = useApp();

  const storePhone = storeSettings?.phone || '231886123456';
  const cleanPhone = storePhone.replace(/[^0-9]/g, '');

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const filtered = products.filter(p => {
    const pCat = (p.category || 'Other').toLowerCase();
    const activeCatLower = activeCategory.toLowerCase();
    const matchesCat = activeCategory === 'All' || pCat === activeCatLower || (activeCategory === 'Hair' && pCat.includes('hair'));
    if (!matchesCat) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  });

  const handleWhatsAppOrder = (product) => {
    const priceUSD = Number(product.retailPrice || 0).toFixed(2);
    const priceLRD = (Number(product.retailPrice || 0) * (exchangeRate || 197)).toLocaleString(undefined, { maximumFractionDigits: 0 });
    
    const message = encodeURIComponent(
      `Hello JAM Beauty Store! 👋\n\nI would like to order:\n🛍️ *${product.name}*\n💰 Price: $${priceUSD} USD (approx. L$${priceLRD})\n📂 Category: ${product.category || 'Beauty'}\n\nPlease confirm availability and delivery options in Monrovia. Thank you!`
    );

    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    window.open(waUrl, '_blank');
  };

  const scrollToCatalog = () => {
    const el = document.getElementById('catalog-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#292524] font-sans antialiased flex flex-col selection:bg-[#efaa9b]/30">
      
      {/* 1. TOP HEADER (Exact layout: Search left, Centered JAM logo, Bag right) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#f0ebe4] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          
          {/* Left: Functional Search Bar */}
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

          {/* Center: Elegant JAM Beauty Logo */}
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

          {/* Right: Shopping Bag + Staff Portal Link */}
          <div className="flex items-center gap-2 sm:gap-3 justify-end">
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 rounded-full text-xs font-semibold transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              <span>WhatsApp Store</span>
            </a>

            <button
              type="button"
              onClick={scrollToCatalog}
              className="relative p-2 text-stone-700 hover:text-[#45150b] transition-colors"
              title="View Catalog Products"
            >
              <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
              {products.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#efaa9b] text-[#45150b] font-bold text-[10px] rounded-full flex items-center justify-center shadow-sm">
                  {products.length > 99 ? '99+' : products.length}
                </span>
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

        {/* 2. CATEGORY NAVIGATION SUBHEADER (Matching exact screenshot styling) */}
        <div className="border-t border-[#f2ece4] bg-white">
          <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none py-2.5 flex items-center justify-center gap-6 sm:gap-8">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  scrollToCatalog();
                }}
                className={`text-[11px] font-medium tracking-[0.18em] transition-all whitespace-nowrap pb-0.5 border-b-2 ${
                  activeCategory === cat.id
                    ? 'border-[#45150b] text-[#45150b] font-bold'
                    : 'border-transparent text-stone-500 hover:text-stone-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 3. HERO BANNER (Exact visual layout and typography from image 2) */}
      <section className="relative overflow-hidden bg-[#f7f2eb] border-b border-[#ede6dc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20 flex flex-col md:flex-row items-center justify-between gap-8 sm:gap-12">
          
          {/* Left Column: Typography & Call to Action */}
          <div className="max-w-xl text-left space-y-4 sm:space-y-6">
            <span className="text-[11px] uppercase tracking-[0.25em] font-semibold text-stone-500 block">
              NEW SEASON
            </span>
            
            <h2 className="font-serif text-4xl sm:text-6xl text-[#292220] font-normal leading-[1.08] tracking-tight">
              Beauty essentials, delivered in Monrovia
            </h2>
            
            <p className="text-sm sm:text-base text-stone-600 font-normal leading-relaxed max-w-md">
              Authentic skincare and fragrance, hand-picked for Liberian skin.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="px-6 py-3.5 bg-[#df9487] hover:bg-[#d48476] text-white text-xs uppercase tracking-[0.18em] font-bold rounded shadow-md shadow-[#df9487]/25 transition-all active:scale-98"
              >
                SHOP THE CATALOG
              </button>
              
              <a
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent("Hello JAM Beauty Store! I would like to inquire about your current fragrance and skincare arrivals.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3.5 text-stone-700 hover:text-[#45150b] text-xs uppercase tracking-[0.15em] font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Ask via WhatsApp</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Micro badges */}
            <div className="pt-4 flex flex-wrap items-center gap-4 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#df9487]" />
                <span>100% Authentic Products</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#df9487]" />
                <span>Same-Day Monrovia Rider Delivery</span>
              </div>
            </div>
          </div>

          {/* Right Column: Luxury Aesthetic Hero Showcase */}
          <div className="relative w-full md:w-1/2 max-w-md aspect-[4/3] sm:aspect-square flex items-center justify-center">
            {/* Soft organic glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#efaa9b]/25 via-white/50 to-[#efaa9b]/10 rounded-3xl blur-2xl pointer-events-none" />
            
            <div className="relative z-10 w-full h-full rounded-2xl overflow-hidden border border-[#ede3d7] bg-white/70 shadow-xl flex items-center justify-center p-6">
              <div className="text-center space-y-3">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#efaa9b]/30 to-[#45150b]/10 flex items-center justify-center p-1.5 border border-[#efaa9b]/40 shadow-inner">
                  <img
                    src="/jam-logo-blush.jpg"
                    alt="JAM Beauty Boutique"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <h3 className="font-serif text-2xl text-[#3a1d17] font-semibold">
                  JAM Beauty Store
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                  Fine French & Arabian Perfumery, Luxury Cosmetics, High-Grade Hair & Body Treatments
                </p>
                <div className="pt-2 flex justify-center gap-2 text-[10px] font-bold tracking-wider text-[#45150b]">
                  <span className="bg-[#efaa9b]/20 px-2.5 py-1 rounded-full">MONROVIA, LIBERIA</span>
                  <span className="bg-stone-100 px-2.5 py-1 rounded-full">USD & LRD ACCEPTED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. "SHOP BY CATEGORY" VISUAL CARDS SECTION (From image 2) */}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {[
            { id: 'Perfume', title: 'Perfume', subtitle: 'Luxury Fragrance' },
            { id: 'Hair', title: 'Hair', subtitle: 'Bundles & Care' },
            { id: 'Skincare', title: 'Skincare', subtitle: 'Glow & Hydrate' },
            { id: 'Body Lotion', title: 'Body Lotion', subtitle: 'Silky Moisture' },
            { id: 'Body Oil', title: 'Body Oil', subtitle: 'Scented Glow' },
            { id: 'Cosmetics', title: 'Cosmetics', subtitle: 'Lips, Eyes & Face' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
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
                <p className="text-[10px] text-stone-500 mt-0.5">
                  {cat.subtitle}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-[#df9487]">
                <span>Browse</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 5. LIVE PRODUCTS CATALOG GRID */}
      <section id="catalog-grid" className="max-w-7xl mx-auto px-4 sm:px-8 py-8 w-full flex-1">
        
        {/* Filter / Search Feedback Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee7de] pb-4 mb-6">
          <div>
            <h4 className="font-serif text-xl text-stone-900">
              {activeCategory === 'All' ? 'All Beauty Essentials' : activeCategory}
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

        {/* Loading state */}
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#df9487] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-stone-500">Loading catalog items from JAM Beauty Store...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map(product => {
              const usd = Number(product.retailPrice || 0).toFixed(2);
              const lrd = (Number(product.retailPrice || 0) * (exchangeRate || 197)).toLocaleString(undefined, { maximumFractionDigits: 0 });
              const inStock = (product.showroomQty || 0) > 0;

              return (
                <div
                  key={product.id || product.barcode}
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

                    {/* Stock badge */}
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

                      {/* WhatsApp Order button */}
                      <button
                        type="button"
                        onClick={() => handleWhatsAppOrder(product)}
                        className="w-full py-2 px-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        <span>Order on WhatsApp</span>
                      </button>
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
              We couldn't find any products in "{activeCategory}". Try selecting another category or clearing your search.
            </p>
            <button
              onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}
              className="mt-3 px-4 py-2 bg-[#df9487] text-white text-xs font-bold rounded-lg"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* 6. STORE CONTACT & MONROVIA LOCATION FOOTER */}
      <footer className="bg-white border-t border-[#eee7de] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-stone-600">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-serif text-lg font-bold tracking-widest text-[#45150b]">JAM BEAUTY</span>
            </div>
            <p className="text-stone-500 leading-relaxed max-w-sm">
              Your premier destination in Monrovia for original French, Arabian & designer fragrances, verified luxury cosmetics, and salon-grade haircare.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">Store Counter & Pickup</p>
            <p className="flex items-center gap-1.5 text-stone-600">
              <MapPin className="w-3.5 h-3.5 text-[#df9487] flex-shrink-0" />
              <span>Monrovia, Liberia · Citywide Motorcycle Rider Delivery</span>
            </p>
            <p className="flex items-center gap-1.5 text-stone-600">
              <Phone className="w-3.5 h-3.5 text-[#df9487] flex-shrink-0" />
              <span>Direct Hotline & WhatsApp: {storePhone}</span>
            </p>
          </div>

          <div className="space-y-2 md:text-right">
            <p className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">Store System Portal</p>
            <p className="text-stone-500">
              Are you an employee or store manager?
            </p>
            {onGoToLogin && (
              <button
                type="button"
                onClick={onGoToLogin}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Access Staff Portal (POS & Inventory)
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-[#f4efe8] py-4 px-4 text-center text-[11px] text-stone-400">
          JAM Beauty Store &copy; {new Date().getFullYear()} · jambeautystore.com · All Rights Reserved
        </div>
      </footer>

      {/* 7. FLOATING ACTION BUTTONS (Exact positioning matching image 2) */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2.5">
        {/* Floating Pink Bag button */}
        <button
          type="button"
          onClick={scrollToCatalog}
          className="w-12 h-12 rounded-full bg-[#df9487] hover:bg-[#d48476] text-white flex items-center justify-center shadow-lg shadow-[#df9487]/30 transition-transform active:scale-95"
          title="Browse Catalog"
        >
          <ShoppingBag className="w-5 h-5 stroke-[2]" />
        </button>

        {/* Floating WhatsApp Chat button */}
        <a
          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent("Hello JAM Beauty Store! I am browsing your online catalog at jambeautystore.com and have a question.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white flex items-center justify-center shadow-lg shadow-[#25D366]/30 transition-transform active:scale-95"
          title="Chat on WhatsApp"
        >
          <MessageCircle className="w-6 h-6 fill-current" />
        </a>
      </div>
    </div>
  );
}
