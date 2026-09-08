import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../contexts/AppContext';
import { useCurrency } from '../../hooks/useCurrency';
import BarcodeScanner from './BarcodeScanner';
import Cart from './Cart';
import ReceiptModal from './ReceiptModal';
import { getPriceForMode } from './PricingModeSwitcher';
import { PackageOpen, AlertCircle, ShoppingBag, Check, Image as ImageIcon, Users, CreditCard, Bluetooth } from 'lucide-react';
import { connectBluetoothPrinter, getConnectedPrinterName } from '../../utils/bluetoothPrinter';

export default function POSView() {
  const { currentUser } = useAuth();
  const { exchangeRate } = useApp();
  const { format } = useCurrency();

  const [allProducts, setAllProducts] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedPosCategory, setSelectedPosCategory] = useState('All');
  const [cartItems, setCartItems] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [completedSale, setCompletedSale] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState(null);
  const [btPrinter, setBtPrinter] = useState(getConnectedPrinterName());

  // Subscribe to live products from Firestore for instant local search
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllProducts(prods);
    });
    return unsub;
  }, []);

  // Subscribe to live customers for customer linking & store credit
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snap) => {
      const custs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCustomersList(custs);
    });
    return unsub;
  }, []);

  const handleSearch = (rawQuery) => {
    if (!rawQuery) return;
    const q = rawQuery.trim().toLowerCase();
    setSearching(true);
    setSearchError('');

    // 1. Check exact barcode match first
    const exactBarcodeMatch = allProducts.find(p => {
      const b = (p.barcode || p.id || '').toString().trim().toLowerCase();
      return b === q;
    });

    if (exactBarcodeMatch) {
      addToCart(exactBarcodeMatch);
      setSearchResults([]);
      setSearching(false);
      return;
    }

    // 2. Fuzzy case-insensitive search across name, barcode, category
    const matches = allProducts.filter(p => {
      const name = (p.name || '').toLowerCase();
      const barcode = (p.barcode || p.id || '').toString().toLowerCase();
      const category = (p.category || '').toLowerCase();

      // Check if all search words match in name/barcode/category
      const queryWords = q.split(/\s+/).filter(Boolean);
      const allWordsMatch = queryWords.every(word =>
        name.includes(word) || barcode.includes(word) || category.includes(word)
      );

      return allWordsMatch || barcode.includes(q) || name.includes(q);
    });

    if (matches.length === 1) {
      addToCart(matches[0]);
      setSearchResults([]);
    } else if (matches.length > 1) {
      setSearchResults(matches);
    } else {
      setSearchResults([]);
      setSearchError(`No product found matching "${rawQuery}". Ensure barcode is added in Inventory.`);
    }

    setSearching(false);
  };

  const addToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.findIndex(i => (i.product.id === product.id || i.product.barcode === product.barcode) && i.pricingMode !== 'discount');
      if (existing >= 0) {
        const updated = [...prev];
        const newQty = updated[existing].quantity + 1;
        updated[existing] = {
          ...updated[existing],
          quantity: newQty,
          total: updated[existing].unitPrice * newQty,
        };
        return updated;
      }
      const unitPrice = getPriceForMode(product, 'retail');
      return [
        ...prev,
        { product, pricingMode: 'retail', quantity: 1, unitPrice, total: unitPrice, discountPct: 0 }
      ];
    });

    // Visual indicator of added product
    setLastAddedProduct(product.name);
    setTimeout(() => setLastAddedProduct(null), 2000);
    setSearchResults([]);
  };

  const updateItem = (index, item) => setCartItems(prev => {
    const u = [...prev];
    u[index] = item;
    return u;
  });

  const removeItem = (index) => setCartItems(prev => prev.filter((_, i) => i !== index));

  const subtotal = cartItems.reduce((s, i) => s + i.total, 0);
  const change = amountPaid ? Math.max(0, parseFloat(amountPaid) - subtotal) : 0;

  const handleCheckout = async () => {
    if (!cartItems.length) return;

    const selectedCust = customersList.find(c => c.id === selectedCustomerId);

    if (paymentMethod === 'Store Credit' && !selectedCust) {
      alert('Please select a registered Customer or VIP Salon to issue Store Credit.');
      return;
    }

    setProcessing(true);
    try {
      const saleData = {
        items: cartItems.map(i => ({
          productId: i.product.id || i.product.barcode,
          name: i.product.name,
          barcode: i.product.barcode || i.product.id || '',
          pricingMode: i.pricingMode,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountPct: i.discountPct || 0,
          total: i.total,
        })),
        total: subtotal,
        discount: 0,
        paymentMethod,
        amountPaid: paymentMethod === 'Store Credit' ? 0 : (parseFloat(amountPaid) || subtotal),
        change: paymentMethod === 'Store Credit' ? 0 : change,
        exchangeRate,
        cashierId: currentUser?.uid || 'staff',
        cashierName: currentUser?.displayName || currentUser?.email || 'Cashier',
        customerId: selectedCust?.id || null,
        customerName: selectedCust?.name || 'Walk-in Customer',
        customerPhone: selectedCust?.phone || '',
        isStoreCredit: paymentMethod === 'Store Credit',
        timestamp: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'sales'), saleData);

      // Decrement showroom quantity in inventory
      for (const item of cartItems) {
        try {
          const pId = item.product.id || item.product.barcode;
          if (pId) {
            await updateDoc(doc(db, 'products', pId), {
              showroomQty: increment(-item.quantity),
            });
          }
        } catch (err) {
          console.warn('Could not decrement product qty:', err);
        }
      }

      // Update customer balance & credit ledger if customer selected
      if (selectedCust) {
        try {
          if (paymentMethod === 'Store Credit') {
            await updateDoc(doc(db, 'customers', selectedCust.id), {
              balanceOwed: increment(subtotal),
              totalSpent: increment(subtotal),
              lastPurchaseDate: serverTimestamp(),
            });
            await addDoc(collection(db, 'customerTransactions'), {
              customerId: selectedCust.id,
              customerName: selectedCust.name,
              type: 'credit_sale',
              amount: subtotal,
              saleId: docRef.id,
              note: `Store credit sale: ${cartItems.length} items`,
              timestamp: serverTimestamp(),
            });
          } else {
            await updateDoc(doc(db, 'customers', selectedCust.id), {
              totalSpent: increment(subtotal),
              lastPurchaseDate: serverTimestamp(),
            });
          }
        } catch (custErr) {
          console.warn('Customer account update warning:', custErr);
        }
      }

      setCompletedSale({ ...saleData, id: docRef.id });
      setCartItems([]);
      setSelectedCustomerId('');
      setCustomerSearchQuery('');
      setCheckoutModal(false);
      setReceiptOpen(true);
      setAmountPaid('');
    } catch (e) {
      alert('Checkout failed: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-0">
      {/* Left: Search & Catalog panel */}
      <div className="md:w-1/2 md:border-r border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
        <BarcodeScanner onSearch={handleSearch} />

        {lastAddedProduct && (
          <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3.5 py-2 rounded-xl text-xs font-medium animate-fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Added to Cart: <strong>{lastAddedProduct}</strong></span>
          </div>
        )}

        {searching && <p className="text-slate-400 text-sm">Searching...</p>}
        {searchError && (
          <p className="text-red-400 text-sm flex items-center gap-1.5 bg-red-900/20 border border-red-800/40 px-3 py-2 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{searchError}</span>
          </p>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">
              {searchResults.length} product{searchResults.length !== 1 ? 's' : ''} found:
            </p>
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {searchResults.map(p => (
                <button
                  key={p.id || p.barcode}
                  onClick={() => addToCart(p)}
                  className="w-full text-left bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-[#efaa9b]/60 rounded-xl p-2.5 transition-all flex items-center gap-3 group"
                >
                  {/* Photo thumbnail */}
                  {p.imageUrl ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-600 bg-black/40 flex-shrink-0">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-slate-700 bg-slate-900/60 flex items-center justify-center flex-shrink-0 text-slate-500 font-bold text-sm">
                      {(p.name || 'P')[0].toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-xs truncate group-hover:text-[#efaa9b]">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-slate-500">{p.barcode || 'No barcode'}</span>
                      <span>·</span>
                      <span className="text-slate-400">{p.category}</span>
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-rose-300 font-bold text-xs">{format(p.retailPrice)}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      (p.showroomQty || 0) < 5 ? 'bg-red-900/50 text-red-300' : 'text-slate-400'
                    }`}>
                      {(p.showroomQty || 0) < 5 ? `Low: ${p.showroomQty || 0}` : `${p.showroomQty || 0} in stock`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Product Pick List when not searching */}
        {searchResults.length === 0 && !searching && !searchError && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Store Catalog ({allProducts.length} items)
              </span>
              <span className="text-[11px] text-slate-500">Tap item to add to cart</span>
            </div>

            {/* Quick Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {['All', 'Perfume', 'Cosmetics', 'Skincare', 'Haircare', 'Accessories', 'Body Care', 'Other'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedPosCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedPosCategory === cat
                      ? 'bg-[#efaa9b] text-[#45150b] font-bold shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {allProducts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 py-12">
                <PackageOpen className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">No products in catalog yet.</p>
                <p className="text-xs text-slate-600">Import your inventory CSV or add products in Inventory.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
                {allProducts
                  .filter(p => selectedPosCategory === 'All' || (p.category || 'Other') === selectedPosCategory)
                  .map(p => (
                    <button
                      key={p.id || p.barcode}
                      onClick={() => addToCart(p)}
                      className="text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 hover:border-[#efaa9b]/60 rounded-xl p-2 transition-all flex items-center gap-2.5"
                    >
                      {/* Thumbnail photo */}
                      {p.imageUrl ? (
                        <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-700 bg-black/40 flex-shrink-0">
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg border border-slate-700 bg-slate-900/60 flex items-center justify-center flex-shrink-0 text-slate-500 font-bold text-xs">
                          {(p.name || 'P')[0].toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-xs truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.barcode || p.category || '—'}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-rose-300 font-bold text-xs">{format(p.retailPrice)}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{p.showroomQty || 0} in stock</span>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Cart panel */}
      <div className="md:w-1/2 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-rose-400" /> Current Cart
          </h2>
          <button
            type="button"
            onClick={async () => {
              try {
                const conn = await connectBluetoothPrinter();
                setBtPrinter(conn.name);
              } catch (e) {
                alert(e.message);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs transition-colors"
            title="Connect 58mm Portable Thermal Printer"
          >
            <Bluetooth className={`w-3.5 h-3.5 ${btPrinter ? 'text-emerald-400' : 'text-[#efaa9b]'}`} />
            <span className="text-[11px] text-slate-300">
              {btPrinter ? btPrinter : 'Connect 58mm Printer'}
            </span>
          </button>
        </div>
        <Cart
          items={cartItems}
          onUpdate={updateItem}
          onRemove={removeItem}
          onCheckout={() => setCheckoutModal(true)}
        />
      </div>

      {/* Checkout modal */}
      {checkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCheckoutModal(false)} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Complete Sale</h3>
            <div className="space-y-3">
              {/* Customer Linking */}
              <div>
                <label className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                  <span>Customer / VIP Salon</span>
                  <span className="text-[10px] text-slate-500">Optional for Cash, Required for Credit</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={e => {
                    setSelectedCustomerId(e.target.value);
                    if (!e.target.value && paymentMethod === 'Store Credit') {
                      setPaymentMethod('Cash');
                    }
                  }}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-rose-400"
                >
                  <option value="">Walk-in Customer (Retail / Direct)</option>
                  {customersList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} - {c.type || 'Salon'} {c.balanceOwed > 0 ? `[Owes: $${c.balanceOwed}]` : ''}
                    </option>
                  ))}
                </select>

                {selectedCustomerId && (() => {
                  const cust = customersList.find(c => c.id === selectedCustomerId);
                  if (!cust) return null;
                  const bal = cust.balanceOwed || 0;
                  const limit = cust.creditLimit || 0;
                  return (
                    <div className="mt-1.5 p-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-[11px] flex justify-between items-center">
                      <div>
                        <span className="text-slate-300 font-semibold">{cust.name}</span>
                        <span className="text-slate-500 ml-1.5">{cust.phone || 'No phone'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400">Balance: </span>
                        <span className={bal > limit && limit > 0 ? 'text-red-400 font-bold' : 'text-amber-300 font-medium'}>
                          ${bal.toFixed(2)}
                        </span>
                        {limit > 0 && <span className="text-slate-500 text-[10px]"> / ${limit}</span>}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Payment Method</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {['Cash', 'MoMo', 'Card', 'Transfer', 'Store Credit'].map(m => {
                    const isCredit = m === 'Store Credit';
                    const disabled = isCredit && !selectedCustomerId;
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={disabled}
                        title={disabled ? 'Select a customer first to enable Store Credit' : ''}
                        onClick={() => {
                          setPaymentMethod(m);
                          if (m === 'Store Credit') setAmountPaid('');
                        }}
                        className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors text-center ${
                          paymentMethod === m
                            ? isCredit ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'bg-rose-500 text-white shadow-md'
                            : disabled
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/30'
                            : 'bg-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {paymentMethod === 'Store Credit' ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                  <p className="font-semibold flex items-center gap-1.5 text-amber-300">
                    <CreditCard className="w-4 h-4" /> Store Credit Invoice
                  </p>
                  <p className="mt-1 text-[11px] text-amber-200/80">
                    This sale will be charged to the customer's open account. No cash collected at drawer today.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Amount Tendered (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value)}
                      placeholder={subtotal.toFixed(2)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
                    />
                  </div>

                  {amountPaid && (
                    <div className="flex justify-between text-sm py-1">
                      <span className="text-slate-400">Change Due:</span>
                      <span className="text-green-400 font-bold">${change.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between items-center font-bold text-white border-t border-slate-700 pt-2.5">
                <span className="text-sm">Total Due</span>
                <span className="text-lg text-rose-300">{format(subtotal)}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setCheckoutModal(false)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckout}
                disabled={processing}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-rose-500/20"
              >
                {processing ? 'Processing...' : 'Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal isOpen={receiptOpen} onClose={() => setReceiptOpen(false)} sale={completedSale} />
    </div>
  );
}
