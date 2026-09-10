import React, { useState, useEffect, useRef, useMemo } from 'react';
import Modal from '../shared/Modal';
import { useCurrency } from '../../hooks/useCurrency';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { compressReceiptImage } from '../../utils/receiptCompressor';
import { 
  PackageCheck, 
  Send, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  FileText, 
  DollarSign,
  Share2,
  Camera,
  Upload,
  X,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Globe,
  Boxes,
  Phone,
  Save
} from 'lucide-react';

const TRADE_HUBS = [
  { id: 'dubai', name: 'Dubai, UAE', flag: '🇦🇪', leadTime: '3-5 weeks', isRegional: false },
  { id: 'china', name: 'Guangzhou / Yiwu, China', flag: '🇨🇳', leadTime: '4-6 weeks', isRegional: false },
  { id: 'nigeria', name: 'Lagos, Nigeria', flag: '🇳🇬', leadTime: '1-2 weeks', isRegional: true },
  { id: 'ghana', name: 'Accra, Ghana', flag: '🇬🇭', leadTime: '1-2 weeks', isRegional: true },
  { id: 'ivory_coast', name: 'Abidjan, Ivory Coast', flag: '🇨🇮', leadTime: '1-2 weeks', isRegional: true },
  { id: 'liberia', name: 'Monrovia, Liberia (Local)', flag: '🇱🇷', leadTime: '1-2 days', isRegional: true },
];

const PAYMENT_SOURCES = [
  { id: 'cash_drawer', label: '💵 Register Cash Drawer', desc: 'Deducted directly from physical drawer balance' },
  { id: 'momo', label: '📱 Mobile Money (MoMo)', desc: 'Lonestar MTN / Orange Money electronic business transfer' },
  { id: 'bank_transfer', label: '🏦 Bank Wire / FX Bureau', desc: 'Telegraphic wire / FX exchange slip' },
  { id: 'credit', label: '⏳ On Terms / Pay Later (COD / Net 30)', desc: 'Log as pending accounts payable' },
];

export default function RestockOrderModal({ 
  isOpen, 
  onClose, 
  supplier = null, 
  targetProduct = null,
  products: propProducts = [], 
  suppliers: propSuppliers = [],
  prefilledItems = [] 
}) {
  const { format } = useCurrency();
  const { currentUser } = useAuth();

  // Internal collections if not passed via props
  const [liveProducts, setLiveProducts] = useState([]);
  const [liveSuppliers, setLiveSuppliers] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    let unsubProd = null;
    let unsubSupp = null;

    if (!propProducts || propProducts.length === 0) {
      unsubProd = onSnapshot(collection(db, 'products'), snap => {
        setLiveProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }
    if (!propSuppliers || propSuppliers.length === 0) {
      unsubSupp = onSnapshot(collection(db, 'suppliers'), snap => {
        setLiveSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    return () => {
      if (unsubProd) unsubProd();
      if (unsubSupp) unsubSupp();
    };
  }, [isOpen, propProducts, propSuppliers]);

  const allProducts = propProducts.length > 0 ? propProducts : liveProducts;
  const allSuppliers = propSuppliers.length > 0 ? propSuppliers : liveSuppliers;

  // Active supplier state
  const [activeSupplier, setActiveSupplier] = useState(supplier);
  const [supplierPhoneInput, setSupplierPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [selectedHub, setSelectedHub] = useState('dubai');
  const [paymentSource, setPaymentSource] = useState('cash_drawer');
  const [shippingFeeUSD, setShippingFeeUSD] = useState('');

  // Receipt upload & security
  const [receiptImage, setReceiptImage] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Determine activeSupplier & initial items upon opening
  useEffect(() => {
    if (!isOpen) return;

    let matchedSupplier = supplier;
    if (!matchedSupplier && targetProduct) {
      if (targetProduct.supplierId) {
        matchedSupplier = allSuppliers.find(s => s.id === targetProduct.supplierId);
      }
      if (!matchedSupplier && targetProduct.supplierName) {
        matchedSupplier = allSuppliers.find(
          s => (s.name || '').trim().toLowerCase() === targetProduct.supplierName.trim().toLowerCase()
        );
      }
      if (!matchedSupplier) {
        matchedSupplier = {
          id: targetProduct.supplierId || 'unassigned',
          name: targetProduct.supplierName || 'Primary Supplier',
          phone: '',
          email: '',
          terms: 'COD',
        };
      }
    }
    setActiveSupplier(matchedSupplier || null);
    setSupplierPhoneInput(matchedSupplier?.phone || '');

    // Initialize items
    if (targetProduct) {
      const showQty = targetProduct.showroomQty || 0;
      const storeQty = targetProduct.storeroomQty || 0;
      const totStock = showQty + storeQty;
      const trig = targetProduct.reorderTrigger || 10;
      const suggestedQty = Math.max(12, (trig * 2) - totStock);

      setItems([{
        productId: targetProduct.id,
        name: targetProduct.name,
        category: targetProduct.category || '',
        currentStock: totStock,
        reorderTrigger: trig,
        costPrice: targetProduct.costPrice != null ? Number(targetProduct.costPrice) : 0,
        orderQty: suggestedQty,
      }]);
    } else if (prefilledItems && prefilledItems.length > 0) {
      setItems(prefilledItems.map(p => ({
        productId: p.id,
        name: p.name,
        category: p.category || '',
        currentStock: (p.showroomQty || 0) + (p.storeroomQty || 0),
        reorderTrigger: p.reorderTrigger || 10,
        costPrice: p.costPrice != null ? Number(p.costPrice) : 0,
        orderQty: Math.max(12, (p.reorderTrigger || 10) * 2 - ((p.showroomQty || 0) + (p.storeroomQty || 0))),
      })));
    } else {
      const relevant = allProducts.filter(p => {
        const totalStock = (p.showroomQty || 0) + (p.storeroomQty || 0);
        const isLow = totalStock <= (p.reorderTrigger || 10);
        if (matchedSupplier) {
          return p.supplierId === matchedSupplier.id || (isLow && !p.supplierId);
        }
        return isLow;
      });

      setItems(relevant.map(p => ({
        productId: p.id,
        name: p.name,
        category: p.category || '',
        currentStock: (p.showroomQty || 0) + (p.storeroomQty || 0),
        reorderTrigger: p.reorderTrigger || 10,
        costPrice: p.costPrice != null ? Number(p.costPrice) : 0,
        orderQty: Math.max(12, (p.reorderTrigger || 10) * 2 - ((p.showroomQty || 0) + (p.storeroomQty || 0))),
      })));
    }

    // Auto-detect hub from supplier notes/address if available
    if (matchedSupplier) {
      const sText = `${matchedSupplier.address || ''} ${matchedSupplier.notes || ''} ${matchedSupplier.name || ''}`.toLowerCase();
      if (sText.includes('china') || sText.includes('guangzhou') || sText.includes('yiwu')) setSelectedHub('china');
      else if (sText.includes('nigeria') || sText.includes('lagos')) setSelectedHub('nigeria');
      else if (sText.includes('ghana') || sText.includes('accra')) setSelectedHub('ghana');
      else if (sText.includes('ivory') || sText.includes('abidjan') || sText.includes('côte')) setSelectedHub('ivory_coast');
      else if (sText.includes('liberia') || sText.includes('monrovia')) setSelectedHub('liberia');
      else setSelectedHub('dubai');
    }

    setNotes('');
    setShippingFeeUSD('');
    setReceiptImage(null);
    setError('');
    setSuccessMsg('');
  }, [isOpen, supplier, targetProduct, prefilledItems, allProducts.length, allSuppliers.length]);

  const updateItemQty = (index, qty) => {
    const val = Math.max(0, parseInt(qty, 10) || 0);
    setItems(prev => {
      const next = [...prev];
      next[index].orderQty = val;
      return next;
    });
  };

  const updateItemCost = (index, cost) => {
    const val = Math.max(0, parseFloat(cost) || 0);
    setItems(prev => {
      const next = [...prev];
      next[index].costPrice = val;
      return next;
    });
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProduct = (productId) => {
    const p = allProducts.find(prod => prod.id === productId);
    if (!p) return;
    if (items.some(it => it.productId === p.id)) return;

    const showQty = p.showroomQty || 0;
    const storeQty = p.storeroomQty || 0;
    const totStock = showQty + storeQty;
    const trig = p.reorderTrigger || 10;
    const suggestedQty = Math.max(12, (trig * 2) - totStock);

    setItems(prev => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        category: p.category || '',
        currentStock: totStock,
        reorderTrigger: trig,
        costPrice: p.costPrice != null ? Number(p.costPrice) : 0,
        orderQty: suggestedQty,
      }
    ]);
  };

  const handleAddAllSupplierProducts = (prodsToAdd) => {
    const newItems = prodsToAdd.map(p => {
      const showQty = p.showroomQty || 0;
      const storeQty = p.storeroomQty || 0;
      const totStock = showQty + storeQty;
      const trig = p.reorderTrigger || 10;
      return {
        productId: p.id,
        name: p.name,
        category: p.category || '',
        currentStock: totStock,
        reorderTrigger: trig,
        costPrice: p.costPrice != null ? Number(p.costPrice) : 0,
        orderQty: Math.max(12, (trig * 2) - totStock),
      };
    });
    setItems(prev => [...prev, ...newItems]);
  };

  const handleSaveSupplierPhone = async () => {
    if (!supplierPhoneInput.trim()) return;
    setSavingPhone(true);
    try {
      if (activeSupplier?.id && activeSupplier.id !== 'unassigned') {
        await updateDoc(doc(db, 'suppliers', activeSupplier.id), {
          phone: supplierPhoneInput.trim(),
          updatedAt: serverTimestamp(),
        });
      }
      setActiveSupplier(prev => ({ ...(prev || {}), phone: supplierPhoneInput.trim() }));
    } catch (err) {
      console.error('Error saving supplier phone:', err);
    } finally {
      setSavingPhone(false);
    }
  };

  // Find all other products supplied by this same vendor
  const sameSupplierProducts = useMemo(() => {
    const sId = activeSupplier?.id;
    const sName = (activeSupplier?.name || targetProduct?.supplierName || '').trim().toLowerCase();
    if (!sId && !sName) return [];

    return allProducts.filter(p => {
      if (items.some(it => it.productId === p.id)) return false;
      const matchId = sId && sId !== 'unassigned' && p.supplierId === sId;
      const matchName = sName && p.supplierName && p.supplierName.trim().toLowerCase() === sName;
      return matchId || matchName;
    });
  }, [allProducts, items, activeSupplier, targetProduct]);

  const handleReceiptFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setError('');
    try {
      const compressed = await compressReceiptImage(file);
      setReceiptImage(compressed);
    } catch (err) {
      console.error('Error compressing receipt:', err);
      setError('Could not process receipt image.');
    } finally {
      setCompressing(false);
    }
  };

  const removeReceipt = () => {
    setReceiptImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalGoodsCost = items.reduce((acc, it) => acc + (it.orderQty * it.costPrice), 0);
  const totalItemUnits = items.reduce((acc, it) => acc + it.orderQty, 0);
  const freightCost = parseFloat(shippingFeeUSD) || 0;
  const grandTotalCost = totalGoodsCost + freightCost;

  const isHighValue = grandTotalCost >= 50;
  const requiresReceipt = isHighValue && paymentSource !== 'credit';

  // Process Restock Order
  const handleProcessOrder = async (mode = 'in_transit') => {
    if (items.length === 0) {
      setError('Please include at least one item to restock.');
      return;
    }
    const invalidQty = items.some(it => it.orderQty <= 0);
    if (invalidQty) {
      setError('Every item must have an order quantity greater than 0.');
      return;
    }

    if (requiresReceipt && !receiptImage) {
      setError('Financial Security Policy: Restock payouts of $50 or more require an attached payment slip, wire receipt, or MoMo screenshot.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const poNumber = `PO-${Date.now().toString().slice(-6)}`;
      const activeHub = TRADE_HUBS.find(h => h.id === selectedHub) || TRADE_HUBS[0];
      const isInstant = mode === 'instant_receive';

      const orderData = {
        poNumber,
        supplierId: activeSupplier?.id || 'unassigned',
        supplierName: activeSupplier?.name || targetProduct?.supplierName || 'International Partner',
        supplierPhone: activeSupplier?.phone || supplierPhoneInput || '',
        supplierEmail: activeSupplier?.email || '',
        supplierTerms: activeSupplier?.terms || 'COD',
        originHub: activeHub.name,
        originFlag: activeHub.flag,
        expectedLeadTime: activeHub.leadTime,
        paymentSource,
        paymentStatus: paymentSource === 'credit' ? 'unpaid' : 'paid',
        items,
        totalItemsCount: items.length,
        totalUnits: totalItemUnits,
        goodsCost: totalGoodsCost,
        freightCost,
        totalCost: grandTotalCost,
        receiptImage: receiptImage || null,
        hasReceipt: !!receiptImage,
        notes,
        status: isInstant ? 'received' : 'in_transit',
        createdAt: serverTimestamp(),
        dispatchedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (isInstant) {
        orderData.receivedAt = serverTimestamp();
        // Increment storeroomQty immediately
        for (const it of items) {
          if (it.productId) {
            await updateDoc(doc(db, 'products', it.productId), {
              storeroomQty: increment(it.orderQty),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      // 1. Save Restock Order
      await addDoc(collection(db, 'restockOrders'), orderData);

      // 2. Automatically Log in Central Finance if cash/funds left the business
      if (paymentSource !== 'credit' && grandTotalCost > 0) {
        await addDoc(collection(db, 'expenses'), {
          category: 'Supplies & Restock',
          amount: grandTotalCost,
          goodsCost: totalGoodsCost,
          freightCost,
          currency: 'USD',
          paymentMethod: paymentSource,
          recipient: `${activeSupplier?.name || targetProduct?.supplierName || 'Supplier'} (${activeHub.flag} ${activeHub.name})`,
          authorizedBy: currentUser?.displayName || 'Store Manager',
          note: `Restock ${poNumber} (${totalItemUnits} units, ${items.length} items from ${activeHub.name})`,
          isRestockPayment: true,
          poNumber,
          receiptImage: receiptImage || null,
          hasReceipt: !!receiptImage,
          isHighValue,
          status: requiresReceipt && !receiptImage ? 'pending_receipt' : 'verified',
          loggedBy: currentUser?.uid || 'staff',
          loggedByName: currentUser?.displayName || 'Staff',
          timestamp: serverTimestamp(),
        });
      }

      setSuccessMsg(
        isInstant
          ? `Order ${poNumber} received! ${totalItemUnits} units added directly to your Storeroom.`
          : `Restock Order ${poNumber} dispatched! Cash outflow recorded in Finance. Track shipment in "In Transit".`
      );

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err) {
      console.error('Error saving restock order:', err);
      setError(err.message || 'Failed to save restock order.');
    } finally {
      setSaving(false);
    }
  };

  // Send WhatsApp Purchase Order
  const handleShareWhatsApp = () => {
    if (items.length === 0) return;
    const rawPhone = (activeSupplier?.phone || supplierPhoneInput || '').replace(/[^0-9]/g, '');
    const phoneWithCode = rawPhone ? (rawPhone.startsWith('231') ? rawPhone : `231${rawPhone.replace(/^0+/, '')}`) : '';
    const activeHub = TRADE_HUBS.find(h => h.id === selectedHub) || TRADE_HUBS[0];

    let msg = `*PURCHASE & RESTOCK ORDER - JAM BEAUTY STORE*\n`;
    msg += `Supplier: ${activeSupplier?.name || targetProduct?.supplierName || 'Partner Supplier'}\n`;
    msg += `Origin Trade Hub: ${activeHub.flag} ${activeHub.name}\n`;
    msg += `Date: ${new Date().toLocaleDateString()}\n`;
    msg += `Payment Mode: ${PAYMENT_SOURCES.find(s => s.id === paymentSource)?.label || paymentSource}\n`;
    msg += `--------------------------------\n`;
    items.forEach((it, idx) => {
      msg += `${idx + 1}. *${it.name}* x ${it.orderQty} units\n`;
      if (it.costPrice > 0) {
        msg += `   Unit Cost: ${format(it.costPrice)} | Line: ${format(it.costPrice * it.orderQty)}\n`;
      }
    });
    msg += `--------------------------------\n`;
    msg += `*Total Units:* ${totalItemUnits} pcs\n`;
    if (totalGoodsCost > 0) {
      msg += `*Goods Total:* ${format(totalGoodsCost)}\n`;
    }
    if (freightCost > 0) {
      msg += `*Est. Freight:* ${format(freightCost)}\n`;
    }
    msg += `*Grand Total:* ${format(grandTotalCost)}\n`;
    if (notes) {
      msg += `*Notes:* ${notes}\n`;
    }
    msg += `\nPlease confirm packaging and dispatch schedule to Monrovia, Liberia. Thank you!`;

    const url = phoneWithCode
      ? `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  const remainingProducts = allProducts.filter(
    p => !items.some(it => it.productId === p.id)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeSupplier ? `Restock: ${activeSupplier.name}` : (targetProduct ? `Restock: ${targetProduct.name}` : 'Generate Restock Order')}
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 text-xs">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Missing Phone Quick-Update for Supplier */}
        {activeSupplier && !activeSupplier.phone && (
          <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <span className="font-semibold text-amber-200 block">No WhatsApp Number for {activeSupplier.name}</span>
                <span className="text-[10px] text-slate-400">Enter phone once to enable 1-click WhatsApp order dispatch:</span>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={supplierPhoneInput}
                onChange={e => setSupplierPhoneInput(e.target.value)}
                placeholder="e.g. 0770000000 or +231..."
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 flex-1 sm:w-44"
              />
              <button
                type="button"
                onClick={handleSaveSupplierPhone}
                disabled={savingPhone || !supplierPhoneInput.trim()}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
              >
                <Save className="w-3 h-3" />
                <span>{savingPhone ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Trade Hub & Origin Selection */}
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
          <label className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-rose-400" />
            <span>Supplier Origin & Freight Route</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TRADE_HUBS.map(hub => (
              <button
                key={hub.id}
                type="button"
                onClick={() => setSelectedHub(hub.id)}
                className={`p-2 rounded-xl text-left border transition-all ${
                  selectedHub === hub.id
                    ? 'bg-rose-500/20 border-rose-500 text-white shadow-sm'
                    : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-xs">
                  <span>{hub.flag}</span>
                  <span className="truncate">{hub.name.split(',')[0]}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{hub.leadTime}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 1-CLICK SAME SUPPLIER PRODUCTS BUNDLING */}
        {sameSupplierProducts.length > 0 && (
          <div className="p-3 bg-rose-950/20 border border-rose-500/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-300 text-xs">
                <Boxes className="w-4 h-4 text-rose-400" />
                <span>Other Products from {activeSupplier?.name || targetProduct?.supplierName} ({sameSupplierProducts.length})</span>
              </div>
              <button
                type="button"
                onClick={() => handleAddAllSupplierProducts(sameSupplierProducts)}
                className="px-2.5 py-1 bg-rose-500 hover:bg-rose-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add All ({sameSupplierProducts.length}) to Restock</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Bundle items from the same supplier to ship together and minimize freight handling:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {sameSupplierProducts.map(p => (
                <div key={p.id} className="p-2 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium text-xs truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span>Stock: {(p.showroomQty || 0) + (p.storeroomQty || 0)}</span>
                      <span>Cost: {format(p.costPrice || 0)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddProduct(p.id)}
                    className="px-2 py-1 bg-slate-800 hover:bg-rose-500 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-0.5 flex-shrink-0 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Other Products from Catalog Dropdown */}
        {remainingProducts.length > 0 && (
          <div>
            <label className="text-slate-400 font-medium mb-1 block">Add Other Catalog Products to this Order</label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddProduct(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="" disabled>+ Choose product from catalog...</option>
              {remainingProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.supplierName ? `[${p.supplierName}]` : ''} (Stock: {(p.showroomQty || 0) + (p.storeroomQty || 0)} / Min: {p.reorderTrigger || 10})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Items Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-2 py-2 text-center">Stock</th>
                  <th className="px-3 py-2 text-center w-20">Order Qty</th>
                  <th className="px-3 py-2 text-right w-24">Unit Cost ($)</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-2 py-2 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No items selected. Select a product above.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const lineSubtotal = (item.orderQty || 0) * (item.costPrice || 0);
                    return (
                      <tr key={item.productId || idx} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 text-white font-medium">
                          <div className="truncate max-w-[160px] sm:max-w-xs">{item.name}</div>
                          {item.category && (
                            <div className="text-[10px] text-slate-400">{item.category}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center text-slate-300">
                          {item.currentStock}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.orderQty}
                            onChange={(e) => updateItemQty(idx, e.target.value)}
                            className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-white focus:outline-none focus:border-rose-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.costPrice}
                            onChange={(e) => updateItemCost(idx, e.target.value)}
                            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-slate-200 focus:outline-none focus:border-rose-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-[#efaa9b]">
                          {format(lineSubtotal)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-1 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Cost Totals Footer */}
          <div className="p-3 bg-slate-900/80 border-t border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Goods Subtotal ({totalItemUnits} units across {items.length} items):</span>
              <span className="font-semibold text-white">{format(totalGoodsCost)}</span>
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Estimated Cargo / Shipping Fee (Optional):</span>
              <div className="relative w-28">
                <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingFeeUSD}
                  onChange={e => setShippingFeeUSD(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-6 pr-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-right text-white font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-extrabold">
              <span className="text-white">Total Outflow Capital:</span>
              <span className="text-emerald-400">{format(grandTotalCost)}</span>
            </div>
          </div>
        </div>

        {/* Payment & Funding Source (Central Finance Link) */}
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
          <label className="text-slate-300 font-semibold block">
            Payment & Funding Source (Central Finance Impact) *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PAYMENT_SOURCES.map(source => (
              <label
                key={source.id}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2 ${
                  paymentSource === source.id
                    ? 'bg-rose-500/15 border-rose-500 text-white'
                    : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="restockPayment"
                  value={source.id}
                  checked={paymentSource === source.id}
                  onChange={() => setPaymentSource(source.id)}
                  className="mt-0.5 text-rose-500 focus:ring-rose-400"
                />
                <div>
                  <span className="font-semibold block text-xs">{source.label}</span>
                  <span className="text-[10px] text-slate-400 block">{source.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Financial Security: Mandatory Receipt Upload for >= $50 */}
        <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-rose-400" />
              <span>Payment Proof / Transaction Slip</span>
              {requiresReceipt && <span className="text-rose-400 font-bold">* (Required for $50+)</span>}
            </label>
            {receiptImage && (
              <button 
                type="button" 
                onClick={removeReceipt}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            )}
          </div>

          {receiptImage ? (
            <div className="flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl border border-emerald-500/30">
              <img 
                src={receiptImage} 
                alt="Payment slip" 
                className="w-12 h-12 object-cover rounded border border-slate-700 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Payment Slip Attached
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Securely stored for shift handover and audit compliance.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleReceiptFile}
                className="hidden" 
                id="restock-receipt-upload"
              />
              <label 
                htmlFor="restock-receipt-upload"
                className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-dashed cursor-pointer transition-colors ${
                  requiresReceipt 
                    ? 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/50 text-amber-200' 
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                }`}
              >
                {compressing ? (
                  <span>Optimizing slip photo...</span>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-rose-400" />
                    <span className="font-semibold">
                      {requiresReceipt 
                        ? '📸 Attach Bank Slip / MoMo Screenshot (Mandatory)' 
                        : '📸 Attach Payment Slip (Optional)'}
                    </span>
                  </>
                )}
              </label>
              <p className="text-[10px] text-slate-500 mt-1">
                Bank wire slip, FX bureau receipt, or MoMo confirmation photo.
              </p>
            </div>
          )}
        </div>

        {/* Order Notes */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">
            Order Notes / Cargo Instructions
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Fragile perfume bottles. Air cargo via DHL / Emirates Freight to Robertsfield."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Send PO to WhatsApp</span>
          </button>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>

            {/* Instant Receive (for locally purchased goods) */}
            <button
              type="button"
              onClick={() => handleProcessOrder('instant_receive')}
              disabled={saving || items.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-colors"
              title="Goods are already inside the Monrovia store"
            >
              <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Goods Already Here (Instant Stock)</span>
            </button>

            {/* Default Overseas Flow: Cash Dispatched & In Transit */}
            <button
              type="button"
              onClick={() => handleProcessOrder('in_transit')}
              disabled={saving || items.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl font-bold transition-colors shadow-md shadow-rose-500/20 active:scale-98"
              title="Dispatches cash from finance and tracks overseas cargo"
            >
              <Ship className="w-4 h-4" />
              <span>{saving ? 'Processing...' : 'Dispatch Cash & Track in Transit'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
