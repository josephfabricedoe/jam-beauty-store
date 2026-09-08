import React, { useState } from 'react';
import { Search, Barcode, Camera } from 'lucide-react';
import BarcodeScannerModal from '../shared/BarcodeScannerModal';

export default function BarcodeScanner({ onSearch }) {
  const [query, setQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setQuery('');
    }
  };

  const handleBarcodeScanned = (scannedCode) => {
    if (scannedCode) {
      onSearch(scannedCode);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search input */}
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search product name or barcode..."
            className="w-full bg-slate-700/60 border border-slate-600 rounded-xl pl-10 pr-24 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-[#efaa9b] focus:ring-1 focus:ring-[#efaa9b] transition-colors text-sm"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-lg font-bold text-xs transition-colors shadow-sm"
          >
            Search
          </button>
        </form>

        {/* Large prominent Barcode Camera Button */}
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl font-bold text-sm transition-all shadow-lg shadow-[#efaa9b]/25 active:scale-95 flex-shrink-0"
        >
          <Camera className="w-5 h-5" />
          <span>Scan Barcode</span>
        </button>
      </div>

      {/* Single-scan Camera Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Scan 1 Item (Camera will close automatically)"
      />
    </div>
  );
}
