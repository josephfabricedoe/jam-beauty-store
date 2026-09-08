import React, { useState, useRef } from 'react';
import Modal from '../shared/Modal';
import { useApp } from '../../contexts/AppContext';
import { useCurrency } from '../../hooks/useCurrency';
import { Printer, Tag, Sparkles, Copy, Sliders, Check } from 'lucide-react';

// Code 128B pattern table for standard alphanumeric barcodes
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP)
];

function generateBarcodeSVG(text) {
  if (!text) return null;
  const safeText = text.toString().trim();
  
  // Start with Start Code B (index 104)
  const codes = [104];
  let checkSum = 104;

  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      codes.push(code);
      checkSum += code * (i + 1);
    }
  }

  // Add checksum and stop symbol
  codes.push(checkSum % 103);
  codes.push(106); // Stop code

  // Convert codes to bar/space sequence
  let barModules = [];
  codes.forEach(c => {
    const pattern = CODE128_PATTERNS[c] || "212222";
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      const isBar = p % 2 === 0;
      for (let w = 0; w < width; w++) {
        barModules.push(isBar ? 1 : 0);
      }
    }
  });

  const totalWidth = barModules.length;
  const height = 46;

  // Build SVG path
  let d = "";
  for (let i = 0; i < barModules.length; i++) {
    if (barModules[i] === 1) {
      d += `M${i},0 L${i + 1},0 L${i + 1},${height} L${i},${height} Z `;
    }
  }

  return (
    <svg viewBox={`0 0 ${totalWidth} ${height}`} className="w-full h-12" preserveAspectRatio="none">
      <path d={d} fill="#000" />
    </svg>
  );
}

export default function BarcodeLabelModal({ isOpen, onClose, initialProduct = null, allProducts = [] }) {
  const { exchangeRate, storeSettings } = useApp();
  const { format } = useCurrency();
  const printContainerRef = useRef(null);

  const [selectedProduct, setSelectedProduct] = useState(initialProduct || (allProducts[0] || null));
  const [labelCopies, setLabelCopies] = useState(6);
  const [columns, setColumns] = useState(3); // 2 or 3 or 4 columns per sheet

  // Update selectedProduct if initialProduct changes
  React.useEffect(() => {
    if (initialProduct) setSelectedProduct(initialProduct);
  }, [initialProduct]);

  if (!isOpen) return null;

  const prod = selectedProduct || allProducts[0];
  const barcodeValue = prod?.barcode || prod?.id || 'JAM-001';
  const usdPrice = Number(prod?.retailPrice || 0).toFixed(2);
  const lrdPrice = (Number(prod?.retailPrice || 0) * (exchangeRate || 197)).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const handlePrint = () => {
    const root = document.getElementById('receipt-print-root');
    if (root && printContainerRef.current) {
      root.innerHTML = printContainerRef.current.innerHTML;
      root.style.display = 'block';
      window.print();
      setTimeout(() => {
        root.innerHTML = '';
        root.style.display = 'none';
      }, 1000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Barcode Label Sticker Generator"
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-black transition-colors shadow-lg shadow-[#efaa9b]/25"
          >
            <Printer className="w-4 h-4" />
            <span>Print {labelCopies} Sticker{labelCopies > 1 ? 's' : ''}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Select Product for Sticker
            </label>
            <select
              value={prod?.id || ''}
              onChange={e => {
                const found = allProducts.find(p => p.id === e.target.value);
                if (found) setSelectedProduct(found);
              }}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#efaa9b]"
            >
              {allProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} · [{p.barcode || 'No Barcode'}] · ${Number(p.retailPrice || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="w-28">
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Copies
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={labelCopies}
              onChange={e => setLabelCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-[#efaa9b]"
            />
          </div>

          <div className="w-32">
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
              Sheet Columns
            </label>
            <div className="grid grid-cols-2 gap-1">
              {[2, 3].map(col => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setColumns(col)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    columns === col ? 'bg-[#efaa9b] text-[#45150b]' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {col} Col
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Sticker Sheet Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#efaa9b]" />
              <span>Sticker Sheet Print Preview ({labelCopies} labels)</span>
            </p>
            <span className="text-[10px] text-slate-500">
              Compatible with A4/Letter sticker sheets & standard 58mm/80mm label rolls
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 max-h-[380px] overflow-y-auto">
            <div
              className={`grid gap-3`}
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: labelCopies }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white text-black p-2.5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between text-center select-none"
                >
                  <p className="font-extrabold text-[10px] tracking-wider uppercase text-gray-800">
                    {storeSettings?.storeName || 'JAM BEAUTY STORE'}
                  </p>
                  <p className="font-bold text-xs text-gray-900 truncate my-0.5" title={prod?.name}>
                    {prod?.name || 'Product Name'}
                  </p>
                  
                  {/* Barcode Render */}
                  <div className="my-1 px-1">
                    {generateBarcodeSVG(barcodeValue)}
                  </div>

                  <p className="font-mono text-[9px] tracking-widest text-gray-600">
                    {barcodeValue}
                  </p>

                  <div className="mt-1 pt-1 border-t border-dashed border-gray-300 flex justify-between items-center text-[10px] font-black">
                    <span className="text-gray-900">${usdPrice} USD</span>
                    <span className="text-gray-600">L${lrdPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Printable Root (Cloned during window.print()) */}
        <div className="hidden">
          <div ref={printContainerRef}>
            <style>{`
              @media print {
                @page { margin: 6mm; size: auto; }
                .barcode-sheet-grid {
                  display: grid !important;
                  grid-template-columns: repeat(${columns}, 1fr) !important;
                  gap: 4mm !important;
                }
                .barcode-sticker-card {
                  box-sizing: border-box !important;
                  border: 1px dashed #ccc !important;
                  padding: 3mm !important;
                  text-align: center !important;
                  page-break-inside: avoid !important;
                  font-family: Arial, sans-serif !important;
                }
              }
            `}</style>
            <div className="barcode-sheet-grid">
              {Array.from({ length: labelCopies }).map((_, idx) => (
                <div key={idx} className="barcode-sticker-card">
                  <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {storeSettings?.storeName || 'JAM BEAUTY STORE'}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', margin: '2px 0' }}>
                    {prod?.name || 'Product'}
                  </div>
                  <div style={{ margin: '3px 0' }}>
                    {generateBarcodeSVG(barcodeValue)}
                  </div>
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '2px' }}>
                    {barcodeValue}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '2px', borderTop: '1px dashed #999', fontSize: '10px', fontWeight: 'bold' }}>
                    <span>${usdPrice} USD</span>
                    <span>L${lrdPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
