import React, { useState } from 'react';
import { Trash2, Plus, Minus } from 'lucide-react';
import PricingModeSwitcher, { getPriceForMode } from './PricingModeSwitcher';
import { useCurrency } from '../../hooks/useCurrency';

export default function Cart({ items, onUpdate, onRemove, onCheckout }) {
  const { format } = useCurrency();

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const updateMode = (index, mode) => {
    const item = items[index];
    const unitPrice = mode === 'discount' ? item.product.retailPrice : getPriceForMode(item.product, mode);
    const total = unitPrice * item.quantity * (mode === 'discount' ? (1 - (item.discountPct || 0) / 100) : 1);
    onUpdate(index, { ...item, pricingMode: mode, unitPrice, total });
  };

  const updateDiscount = (index, pct) => {
    const item = items[index];
    const unitPrice = item.product.retailPrice;
    const total = unitPrice * item.quantity * (1 - pct / 100);
    onUpdate(index, { ...item, discountPct: pct, unitPrice, total });
  };

  const updateQty = (index, delta) => {
    const item = items[index];
    const qty = Math.max(1, item.quantity + delta);
    const total = item.unitPrice * qty * (item.pricingMode === 'discount' ? (1 - (item.discountPct || 0) / 100) : 1);
    onUpdate(index, { ...item, quantity: qty, total });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
        </div>
        <p className="text-sm">Cart is empty</p>
        <p className="text-xs mt-1">Search or scan a product to add</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {items.map((item, i) => (
          <div key={i} className="bg-slate-700/50 border border-slate-600/50 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                <p className="text-xs text-slate-500">{item.product.barcode}</p>
              </div>
              <button onClick={() => onRemove(i)} className="p-1 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <PricingModeSwitcher
                mode={item.pricingMode}
                onChange={mode => updateMode(i, mode)}
                discountPct={item.discountPct || 0}
                onDiscountChange={pct => updateDiscount(i, pct)}
              />
              <div className="flex items-center gap-2">
                <button onClick={() => updateQty(i, -1)} className="w-6 h-6 rounded-full bg-slate-600 hover:bg-slate-500 flex items-center justify-center transition-colors">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQty(i, +1)} className="w-6 h-6 rounded-full bg-slate-600 hover:bg-slate-500 flex items-center justify-center transition-colors">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-sm font-semibold text-rose-300 ml-1">{format(item.total)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Total + checkout */}
      <div className="border-t border-slate-700 pt-3 mt-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
          <span className="text-xl font-bold text-white">{format(subtotal)}</span>
        </div>
        <button
          onClick={() => onCheckout(subtotal)}
          className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-rose-500/20"
        >
          Checkout — {format(subtotal)}
        </button>
      </div>
    </div>
  );
}
