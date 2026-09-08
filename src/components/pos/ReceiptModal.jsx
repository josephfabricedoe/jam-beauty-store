import React, { useRef, useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { useApp } from '../../contexts/AppContext';
import {
  Printer,
  Share2,
  Bluetooth,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  printToBluetoothThermalPrinter,
  buildSaleReceiptEscPos,
  getConnectedPrinterName,
  isWebBluetoothSupported,
  connectBluetoothPrinter,
} from '../../utils/bluetoothPrinter';

export default function ReceiptModal({ isOpen, onClose, sale }) {
  const { storeSettings, exchangeRate } = useApp();
  const receiptRef = useRef(null);

  const [btStatus, setBtStatus] = useState('idle'); // 'idle' | 'connecting' | 'printing' | 'success' | 'error'
  const [btError, setBtError] = useState('');
  const [printerName, setPrinterName] = useState(getConnectedPrinterName());
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBtStatus('idle');
      setBtError('');
      setPrinterName(getConnectedPrinterName());
    }
  }, [isOpen]);

  if (!sale) return null;

  const lrd = (usd) => (usd * exchangeRate).toFixed(0);

  // 1. Direct Web Bluetooth Print (Sends 32-column ESC/POS commands directly to 58mm portable printer)
  const handleBluetoothPrint = async () => {
    setBtStatus('printing');
    setBtError('');

    try {
      const escPosBytes = buildSaleReceiptEscPos(sale, storeSettings, exchangeRate);
      const res = await printToBluetoothThermalPrinter(escPosBytes);

      setPrinterName(res.printerName);
      setBtStatus('success');

      setTimeout(() => {
        setBtStatus('idle');
      }, 3000);
    } catch (err) {
      console.error('Bluetooth print failed:', err);
      setBtStatus('error');
      setBtError(
        err.message ||
          'Failed to communicate with Bluetooth printer. Please ensure the printer is turned ON and Bluetooth is enabled on your phone.'
      );
    }
  };

  // Pair printer ahead of time
  const handlePairPrinter = async () => {
    setBtStatus('connecting');
    setBtError('');
    try {
      const conn = await connectBluetoothPrinter();
      setPrinterName(conn.name);
      setBtStatus('idle');
    } catch (err) {
      setBtStatus('error');
      setBtError(err.message || 'Could not pair with Bluetooth printer.');
    }
  };

  // 2. Fallback Standard System Print (Triggers Android Print Spooler / AirPrint)
  const handleSystemPrint = () => {
    const root = document.getElementById('receipt-print-root');
    if (root && receiptRef.current) {
      root.innerHTML = receiptRef.current.innerHTML;
      root.style.display = 'block';
      window.print();
      setTimeout(() => {
        root.innerHTML = '';
        root.style.display = 'none';
      }, 1000);
    }
  };

  // 3. WhatsApp Share
  const handleShareWhatsApp = () => {
    const itemsList = (sale.items || [])
      .map((i) => `• ${i.name} x${i.quantity} — $${Number(i.total).toFixed(2)}`)
      .join('\n');
    const storeName = storeSettings?.storeName || 'JAM BEAUTY STORE';
    const receiptNo = sale.receiptNo || sale.id?.slice(-6).toUpperCase();
    const dateStr = new Date(sale.timestamp?.toDate?.() || Date.now()).toLocaleDateString();

    const text =
      `🌸 *${storeName}* 🌸\n` +
      `🧾 *Receipt #${receiptNo}*\n` +
      `📅 Date: ${dateStr}\n` +
      `👤 Client: ${sale.customerName || 'Valued Customer'}${sale.customerPhone ? ` (${sale.customerPhone})` : ''}\n\n` +
      `*Purchased Items:*\n${itemsList}\n\n` +
      (sale.discount > 0 ? `🏷️ *Order Discount:* -$${Number(sale.discount).toFixed(2)}\n` : '') +
      `💵 *TOTAL USD:* $${Number(sale.total).toFixed(2)}\n` +
      `🇱🇷 *TOTAL LRD:* L$${lrd(sale.total)}\n` +
      `💳 Payment: ${sale.paymentMethod || 'Cash'}\n` +
      (sale.amountPaid > 0 ? `💵 Paid Today: $${Number(sale.amountPaid).toFixed(2)}\n` : '') +
      (sale.balanceOwed > 0 ? `⚠️ *BALANCE DUE (Credit):* $${Number(sale.balanceOwed).toFixed(2)}\n` : '') +
      (sale.change > 0 ? `🪙 Change: $${Number(sale.change).toFixed(2)}\n` : '') +
      `\nThank you for choosing JAM Beauty Store! ✨`;

    const cleanPhone = (sale.customerPhone || '').replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sale Receipt"
      size="sm"
      footer={
        <div className="space-y-2.5 w-full">
          {/* Bluetooth Status Alert */}
          {btStatus === 'error' && (
            <div className="text-xs text-red-300 bg-red-950/60 border border-red-800/60 p-2.5 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-200">Bluetooth Notice</p>
                <p className="text-[11px] mt-0.5 leading-relaxed">{btError}</p>
              </div>
            </div>
          )}

          {btStatus === 'success' && (
            <div className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 p-2.5 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Printed successfully to {printerName || '58mm Printer'}!</span>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {/* Direct Bluetooth 58mm Thermal Print Button */}
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={btStatus === 'printing' || btStatus === 'connecting'}
              className="flex-1 px-4 py-2.5 bg-[#efaa9b] hover:bg-[#e89887] active:scale-95 text-[#45150b] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {btStatus === 'printing' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#45150b] border-t-transparent rounded-full animate-spin" />
                  <span>Printing 58mm...</span>
                </>
              ) : btStatus === 'connecting' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#45150b] border-t-transparent rounded-full animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>Print (Bluetooth)</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Options & Printer Connection Row */}
          <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  printerName ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="text-[11px] text-slate-400">
                {printerName ? `Paired: ${printerName}` : 'No printer paired'}
              </span>
              {!printerName && isWebBluetoothSupported() && (
                <button
                  type="button"
                  onClick={handlePairPrinter}
                  className="text-[11px] text-[#efaa9b] hover:underline font-semibold ml-1"
                >
                  Pair 58mm
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSystemPrint}
                className="text-[11px] text-slate-400 hover:text-white underline transition-colors"
                title="Print via Android Print Spooler or save as PDF"
              >
                System Print / PDF
              </button>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="text-slate-400 hover:text-[#efaa9b] p-0.5"
                title="Printer Setup Help"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Helpful 58mm Bluetooth Printer Guide */}
          {showHelp && (
            <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-xl text-[11px] text-slate-300 space-y-1.5 animate-fade-in">
              <p className="font-bold text-[#efaa9b]">How to print to your 58mm Portable Thermal Printer:</p>
              <p>
                <strong>1. Direct Bluetooth (Recommended):</strong> Make sure your thermal printer is turned ON. Tap the peach <strong>"Print (Bluetooth)"</strong> button. Select your printer name (e.g. <em>MPT-II</em> or <em>POS-58</em>) in the Chrome popup. The receipt will print instantly!
              </p>
              <p>
                <strong>2. If you see "Save as PDF":</strong> That means Android's system print dialog was triggered. To print from that dialog, tap <strong>Save as PDF ▼</strong> at the top of your screen and select your Bluetooth printer (requires the free <em>RawBT</em> or <em>ESC POS Print Service</em> app from Play Store).
              </p>
            </div>
          )}
        </div>
      }
    >
      <div
        ref={receiptRef}
        className="receipt-print font-mono text-xs bg-white text-black p-4 rounded-lg select-none"
      >
        <div className="text-center mb-3">
          <img
            src="/jam-logo-white.jpg"
            alt="JAM Beauty Store"
            className="w-16 h-16 mx-auto mb-1.5 object-contain"
          />
          <div className="font-bold text-sm tracking-wide">
            {storeSettings?.storeName || 'JAM BEAUTY STORE'}
          </div>
          {storeSettings?.address && (
            <div className="text-[11px] text-gray-600">{storeSettings.address}</div>
          )}
          {storeSettings?.phone && (
            <div className="text-[11px] text-gray-600">Tel: {storeSettings.phone}</div>
          )}
          <div className="border-b border-dashed border-gray-400 my-2" />
          <div>Receipt #{sale.receiptNo || sale.id?.slice(-6).toUpperCase()}</div>
          <div>{new Date(sale.timestamp?.toDate?.() || Date.now()).toLocaleString()}</div>
          <div className="border-b border-dashed border-gray-400 my-2" />
        </div>

        {/* Customer if present */}
        {sale.customerName && sale.customerName !== 'Walk-in Customer' && (
          <div className="mb-2 pb-1 border-b border-dashed border-gray-300 text-[11px]">
            <span className="text-gray-600">Client: </span>
            <span className="font-bold">{sale.customerName}</span>
          </div>
        )}

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
                <td className="py-0.5 pr-1">
                  {item.name}
                  <br />
                  <span className="text-gray-500">{item.pricingMode}</span>
                </td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">${Number(item.unitPrice).toFixed(2)}</td>
                <td className="text-right">${Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-gray-400 pt-2 space-y-0.5">
          {sale.discount > 0 && (
            <div className="flex justify-between">
              <span>Order Discount:</span>
              <span>-${Number(sale.discount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>TOTAL USD:</span>
            <span>${Number(sale.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>TOTAL LRD:</span>
            <span>L${lrd(sale.total)}</span>
          </div>
          <div className="border-t border-dashed border-gray-400 mt-1 pt-1">
            <div className="flex justify-between">
              <span>Payment:</span>
              <span>{sale.paymentMethod || 'Cash'}</span>
            </div>
            {sale.amountPaid > 0 && (
              <div className="flex justify-between">
                <span>Paid Today:</span>
                <span>${Number(sale.amountPaid).toFixed(2)}</span>
              </div>
            )}
            {sale.balanceOwed > 0 && (
              <div className="flex justify-between font-bold text-red-600">
                <span>BALANCE DUE (Credit):</span>
                <span>${Number(sale.balanceOwed).toFixed(2)}</span>
              </div>
            )}
            {sale.change > 0 && (
              <div className="flex justify-between">
                <span>Change:</span>
                <span>${Number(sale.change).toFixed(2)}</span>
              </div>
            )}
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
