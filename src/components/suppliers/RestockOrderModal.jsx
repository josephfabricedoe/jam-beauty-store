import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { useCurrency } from '../../hooks/useCurrency';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
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
  Share2
} from 'lucide-react';

export default function RestockOrderModal({ 
  isOpen, 
  onClose, 
  supplier = null, 
  products = [], 
  prefilledItems = [] 
}) {
  const { format } = useCurrency();
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (prefilledItems && prefilledItems.length > 0) {
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
        // Find products belonging to supplier or general low stock
        const relevant = products.filter(p => {
          const totalStock = (p.showroomQty || 0) + (p.storeroomQty || 0);
          const isLow = totalStock <= (p.reorderTrigger || 10);
          if (supplier) {
            return p.supplierId === supplier.id || (isLow && !p.supplierId);
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

      setNotes('');
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen, supplier, products, prefilledItems]);

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
    const p = products.find(prod => prod.id === productId);
    if (!p) return;
    if (items.some(it => it.productId === p.id)) return;

    setItems(prev => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        category: p.category || '',
        currentStock: (p.showroomQty || 0) + (p.storeroomQty || 0),
        reorderTrigger: p.reorderTrigger || 10,
        costPrice: p.costPrice != null ? Number(p.costPrice) : 0,
        orderQty: 12,
      }
    ]);
  };

  const totalEstimatedCost = items.reduce((acc, it) => acc + (it.orderQty * it.costPrice), 0);
  const totalItemUnits = items.reduce((acc, it) => acc + it.orderQty, 0);

  // Generate Restock Order
  const handleCreateOrder = async (isInstantRestock = false) => {
    if (items.length === 0) {
      setError('Please include at least one item in the order.');
      return;
    }
    const invalidQty = items.some(it => it.orderQty <= 0);
    if (invalidQty) {
      setError('Every line item must have an order quantity greater than 0.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const poNumber = `PO-${Date.now().toString().slice(-6)}`;
      const orderData = {
        poNumber,
        supplierId: supplier?.id || 'unassigned',
        supplierName: supplier?.name || 'General Supplier',
        supplierPhone: supplier?.phone || '',
        supplierEmail: supplier?.email || '',
        supplierTerms: supplier?.terms || 'COD',
        leadTimeDays: supplier?.leadTimeDays || 0,
        items,
        totalItemsCount: items.length,
        totalUnits: totalItemUnits,
        totalCost: totalEstimatedCost,
        notes,
        status: isInstantRestock ? 'received' : 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (isInstantRestock) {
        orderData.receivedAt = serverTimestamp();
        // Immediately increment storeroomQty for each product in Firestore
        for (const it of items) {
          if (it.productId) {
            await updateDoc(doc(db, 'products', it.productId), {
              storeroomQty: increment(it.orderQty),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      await addDoc(collection(db, 'restockOrders'), orderData);

      setSuccessMsg(
        isInstantRestock
          ? `Order ${poNumber} created and ${totalItemUnits} units added directly into Storeroom!`
          : `Restock Order ${poNumber} successfully saved!`
      );

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Error saving restock order:', err);
      setError(err.message || 'Failed to save restock order.');
    } finally {
      setSaving(false);
    }
  };

  // Send purchase order via WhatsApp
  const handleShareWhatsApp = () => {
    if (items.length === 0) return;
    const phone = supplier?.phone ? supplier.phone.replace(/[^0-9]/g, '') : '';
    const phoneWithCode = phone.startsWith('231') ? phone : `231${phone.replace(/^0+/, '')}`;

    let msg = `*PURCHASE & RESTOCK ORDER - JAM BEAUTY STORE*\n`;
    msg += `Supplier: ${supplier?.name || 'Partner Supplier'}\n`;
    msg += `Date: ${new Date().toLocaleDateString()}\n`;
    msg += `--------------------------------\n`;
    items.forEach((it, idx) => {
      msg += `${idx + 1}. *${it.name}* x ${it.orderQty} units\n`;
      if (it.costPrice > 0) {
        msg += `   Est. Unit: ${format(it.costPrice)} | Line: ${format(it.costPrice * it.orderQty)}\n`;
      }
    });
    msg += `--------------------------------\n`;
    msg += `*Total Units:* ${totalItemUnits} pcs\n`;
    if (totalEstimatedCost > 0) {
      msg += `*Total Est. Value:* ${format(totalEstimatedCost)}\n`;
    }
    if (notes) {
      msg += `*Notes:* ${notes}\n`;
    }
    msg += `\nPlease confirm availability and dispatch schedule. Thank you!`;

    const url = phone
      ? `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  const remainingProducts = products.filter(
    p => !items.some(it => it.productId === p.id)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? `Restock Order: ${supplier.name}` : 'Generate Purchase Restock Order'}
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Supplier Brief */}
        {supplier && (
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400">Supplier:</span>{' '}
              <span className="font-semibold text-white">{supplier.name}</span>{' '}
              <span className="text-slate-500 font-mono">({supplier.code || 'N/A'})</span>
            </div>
            {supplier.terms && (
              <div>
                <span className="text-slate-400">Terms:</span>{' '}
                <span className="text-amber-300 font-medium">{supplier.terms}</span>
              </div>
            )}
            <div>
              <span className="text-slate-400">Avg Lead Time:</span>{' '}
              <span className="text-rose-300 font-medium">{supplier.leadTimeDays || 0} days</span>
            </div>
          </div>
        )}

        {/* Add Product Dropdown */}
        {remainingProducts.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddProduct(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="" disabled>+ Add product to restock order...</option>
              {remainingProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {(p.showroomQty || 0) + (p.storeroomQty || 0)} / Min: {p.reorderTrigger || 10})
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
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-2 py-2.5 text-center">Current</th>
                  <th className="px-2 py-2.5 text-center">Min Trigger</th>
                  <th className="px-3 py-2.5 text-center w-24">Order Qty</th>
                  <th className="px-3 py-2.5 text-right w-24">Unit Cost</th>
                  <th className="px-3 py-2.5 text-right">Subtotal</th>
                  <th className="px-2 py-2.5 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No items currently selected for restocking. Select a product above.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const lineSubtotal = (item.orderQty || 0) * (item.costPrice || 0);
                    const isDeficit = item.currentStock <= item.reorderTrigger;

                    return (
                      <tr key={item.productId || idx} className="hover:bg-slate-800/40">
                        <td className="px-3 py-2 text-white font-medium">
                          <div className="truncate max-w-[180px] sm:max-w-xs">{item.name}</div>
                          {item.category && (
                            <div className="text-[10px] text-slate-400">{item.category}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            isDeficit ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-300'
                          }`}>
                            {item.currentStock}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center text-slate-400">
                          {item.reorderTrigger}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.orderQty}
                            onChange={(e) => updateItemQty(idx, e.target.value)}
                            className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-white focus:outline-none focus:border-rose-500"
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
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
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

          {/* Order Summary footer */}
          <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Total: <strong className="text-white">{items.length}</strong> items ({totalItemUnits} units)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Est. Order Cost:</span>
              <span className="text-sm font-extrabold text-emerald-400">{format(totalEstimatedCost)}</span>
            </div>
          </div>
        </div>

        {/* Order Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Order Notes / Special Delivery Instructions
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Please deliver by Thursday. Inspect fragile perfume bottles before dispatch."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Send to Supplier on WhatsApp
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleCreateOrder(false)}
              disabled={saving || items.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Save PO (Pending)
            </button>

            <button
              type="button"
              onClick={() => handleCreateOrder(true)}
              disabled={saving || items.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              {saving ? 'Processing...' : 'Restock into Storeroom'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
