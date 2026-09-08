import React, { useRef } from 'react';
import Modal from '../shared/Modal';
import { useApp } from '../../contexts/AppContext';
import { Printer, Share2, CheckCircle } from 'lucide-react';

export default function ReceiptModal({ isOpen, onClose, sale }) {
  const { storeSettings, exchangeRate } = useApp();
  const receiptRef = useRef(null);

  if (!sale) return null;

  const handlePrint = () => {
    const root = document.getElementById('receipt-print-root');
    if (root && receiptRef.current) {
      root.innerHTML = receiptRef.current.innerHTML;
      root.style.display = 'block';
      window.print();
      setTimeout(() => { root.innerHTML = ''; root.style.display = 'none'; }, 1000);
    }
  };

  const lrd = (usd) => (usd * exchangeRate).toFixed(0);

  const handleShareWhatsApp = () => {
    const itemsList = (sale.items || []).map(i => `• ${i.name} x${i.quantity} — $${Number(i.total).toFixed(2)}`).join('\n');
    const storeName = storeSettings?.storeName || 'JAM BEAUTY STORE';
    const receiptNo = sale.receiptNo || sale.id?.slice(-6).toUpperCase();
    const dateStr = new Date(sale.timestamp?.toDate?.() || Date.now()).toLocaleDateString();

    const text = `🌸 *${storeName}* 🌸\n` +
      `🧾 *Receipt #${receiptNo}*\n` +
      `📅 Date: ${dateStr}\n` +
      `👤 Client: ${sale.customerName || 'Valued Customer'}\n\n` +
      `*Purchased Items:*\n${itemsList}\n\n` +
      `💵 *TOTAL USD:* $${Number(sale.total).toFixed(2)}\n` +
      `🇱🇷 *TOTAL LRD:* L$${lrd(sale.total)}\n` +
      `💳 Payment: ${sale.paymentMethod || 'Cash'}\n\n` +
      `Thank you for choosing JAM Beauty Store! ✨`;

    const cleanPhone = (sale.customerPhone || '').replace(/\D/g, '');
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sale Receipt" size="sm"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-colors">Close</button>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" /> WhatsApp
          </button>
          <button onClick={handlePrint} className="flex-1 px-3 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      }
    >
      <div ref={receiptRef} className="receipt-print font-mono text-xs bg-white text-black p-4 rounded-lg">
        <div className="text-center mb-3">
          <img
            src="/jam-logo-white.jpg"
            alt="JAM Beauty Store"
            className="w-16 h-16 mx-auto mb-1.5 object-contain"
          />
          <div className="font-bold text-sm tracking-wide">{storeSettings?.storeName || 'JAM BEAUTY STORE'}</div>
          {storeSettings?.address && <div className="text-[11px] text-gray-600">{storeSettings.address}</div>}
          {storeSettings?.phone && <div className="text-[11px] text-gray-600">Tel: {storeSettings.phone}</div>}
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div>Receipt #{sale.receiptNo || sale.id?.slice(-6).toUpperCase()}</div>
          <div>{new Date(sale.timestamp?.toDate?.() || Date.now()).toLocaleString()}</div>
          <div className="border-b border-dashed border-gray-400 my-2" />
        </div>

        {/* Items */}
        <table className="w-full text-xs mb-3">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-0.5">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(sale.items || []).map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-0.5 pr-1">{item.name}<br/><span className="text-gray-500">{item.pricingMode}</span></td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">${Number(item.unitPrice).toFixed(2)}</td>
                <td className="text-right">${Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-400 pt-2 space-y-0.5">
          {sale.discount > 0 && <div className="flex justify-between"><span>Discount:</span><span>-${Number(sale.discount).toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold">
            <span>TOTAL USD:</span><span>${Number(sale.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>TOTAL LRD:</span><span>L${lrd(sale.total)}</span>
          </div>
          <div className="border-t border-dashed border-gray-400 mt-1 pt-1">
            <div className="flex justify-between"><span>Payment:</span><span>{sale.paymentMethod || 'Cash'}</span></div>
            {sale.amountPaid > 0 && <div className="flex justify-between"><span>Paid:</span><span>${Number(sale.amountPaid).toFixed(2)}</span></div>}
            {sale.change > 0 && <div className="flex justify-between"><span>Change:</span><span>${Number(sale.change).toFixed(2)}</span></div>}
          </div>
        </div>

        <div className="text-center mt-3 text-gray-500">
          <div>Thank you for shopping!</div>
          <div>Powered by JAM Beauty Store</div>
        </div>
      </div>
    </Modal>
  );
}
