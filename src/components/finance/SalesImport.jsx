import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Upload, Download, CheckCircle, AlertCircle, FileText, ArrowRight } from 'lucide-react';

function getColValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return String(row[name]).trim();
    }
  }
  return '';
}

function parseFlexibleDate(dateStr) {
  if (!dateStr) return new Date();

  // Try standard ISO or direct Date parse
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try DD/MM/YYYY or MM/DD/YYYY
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    // If p2 is 4 digits (e.g. 2024), assume p0 = day/month, p1 = month/day
    if (p2 > 1000) {
      // Test if p0 > 12 -> then p0 is definitely day
      if (p0 > 12) {
        return new Date(p2, p1 - 1, p0);
      }
      return new Date(p2, p0 - 1, p1);
    }
  }

  return new Date();
}

export default function SalesImport({ onImportComplete }) {
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setDone(false);
    setErrors([]);
    setProgress(0);
    setImportedCount(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        setHeaders(meta.fields || []);
        setPreview(data.slice(0, 5));
      },
      error: (err) => {
        setErrors(['CSV parse error: ' + err.message]);
      }
    });
  };

  const handleImport = () => {
    if (!fileRef.current?.files[0]) return;
    setImporting(true);
    setDone(false);
    setErrors([]);

    Papa.parse(fileRef.current.files[0], {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        const errs = [];
        let count = 0;

        for (const row of data) {
          try {
            const rawDate = getColValue(row, ['date', 'Date', 'DATE', 'timestamp', 'Timestamp', 'time', 'Time']);
            const rawProduct = getColValue(row, ['productName', 'product', 'Product', 'item', 'Item', 'name', 'Name', 'Description']) || 'Imported Item';
            const rawBarcode = getColValue(row, ['barcode', 'Barcode', 'BARCODE', 'sku', 'SKU', 'code', 'Code']);
            const rawQty = getColValue(row, ['quantity', 'Quantity', 'qty', 'Qty', 'QTY', 'count', 'Count']);
            const rawUnitPrice = getColValue(row, ['unitPrice', 'unit_price', 'UnitPrice', 'price', 'Price', 'RATE', 'rate']);
            const rawTotal = getColValue(row, ['total', 'Total', 'TOTAL', 'amount', 'Amount', 'net', 'Net']);
            const rawMethod = getColValue(row, ['paymentMethod', 'payment_method', 'PaymentMethod', 'method', 'Method', 'Payment', 'type']) || 'Cash';
            const rawCashier = getColValue(row, ['cashierName', 'cashier', 'Cashier', 'staff', 'Staff', 'agent', 'Agent']) || 'Historical Import';
            const rawNote = getColValue(row, ['note', 'Note', 'memo', 'Memo', 'remarks', 'Remarks']);

            const qty = parseInt(rawQty, 10) || 1;
            let unitPrice = parseFloat(rawUnitPrice.replace(/[^0-9.]/g, '')) || 0;
            let total = parseFloat(rawTotal.replace(/[^0-9.]/g, '')) || 0;

            if (!total && unitPrice) total = unitPrice * qty;
            if (!unitPrice && total && qty) unitPrice = total / qty;

            const dateObj = parseFlexibleDate(rawDate);

            await addDoc(collection(db, 'sales'), {
              items: [{
                name: rawProduct,
                barcode: rawBarcode,
                quantity: qty,
                unitPrice,
                total,
                pricingMode: 'retail',
              }],
              total,
              discount: 0,
              paymentMethod: rawMethod,
              cashierId: 'imported',
              cashierName: rawCashier,
              note: rawNote || 'Imported from spreadsheet',
              timestamp: Timestamp.fromDate(dateObj),
              imported: true,
            });

            count++;
            setProgress(Math.round((count / data.length) * 100));
          } catch (e) {
            errs.push(`Row ${count + 1}: ${e.message}`);
          }
        }

        setImportedCount(count);
        setErrors(errs);
        setImporting(false);
        setDone(true);
        setPreview([]);
        setFileName('');
        if (fileRef.current) fileRef.current.value = '';

        if (onImportComplete) {
          onImportComplete(count);
        }
      }
    });
  };

  const downloadTemplate = () => {
    window.open('/sales-template.csv', '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Download template */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300 font-medium">Import Previous Sales Records</p>
          <p className="text-xs text-slate-500">
            Import historical receipts and spreadsheet data directly into the application's sales ledger.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>Download CSV Format</span>
        </button>
      </div>

      {/* Column guide */}
      <div className="bg-slate-700/30 border border-slate-700 rounded-xl p-3">
        <p className="text-xs text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">
          Recognized Spreadsheet Columns:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['date', 'productName', 'quantity', 'unitPrice', 'total', 'paymentMethod'].map(c => (
            <span key={c} className="text-xs bg-slate-700 text-rose-300 px-2 py-0.5 rounded font-mono font-medium">
              {c}
            </span>
          ))}
          <span className="text-xs text-slate-400 self-center ml-1">
            + optional: <code>barcode</code>, <code>cashierName</code>, <code>note</code>
          </span>
        </div>
      </div>

      {/* File picker dropzone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          handleFile(e.dataTransfer.files[0]);
        }}
        className="border-2 border-dashed border-slate-600 hover:border-rose-400 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-900/30"
      >
        <Upload className="w-9 h-9 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-300 font-medium">
          {fileName || 'Click or drag your historical sales CSV file here'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Supports .csv spreadsheets exported from Excel, Google Sheets, or previous POS
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 flex items-center gap-1 font-medium">
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>Ready to import — First 5 rows preview:</span>
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-400">
                  {headers.map(h => (
                    <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/40">
                    {headers.map(h => (
                      <td key={h} className="px-3 py-2 text-slate-300 whitespace-nowrap">{row[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="w-full py-3 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
          >
            <Upload className="w-4 h-4" />
            <span>{importing ? `Importing Records into Database (${progress}%)...` : 'Import All Sales into JAM Beauty Store'}</span>
          </button>

          {importing && (
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Done banner */}
      {done && (
        <div className={`rounded-2xl p-4 border ${
          errors.length > 0 ? 'bg-amber-950/40 border-amber-500/40' : 'bg-emerald-950/40 border-emerald-500/40'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {errors.length > 0 ? (
              <AlertCircle className="w-5 h-5 text-amber-400" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            )}
            <p className="text-sm font-bold text-white">
              Successfully imported {importedCount} sales transactions into the system!
            </p>
          </div>
          <p className="text-xs text-slate-300 mb-3">
            All records have been saved to your sales database. Click <strong>"All Time (Inc. Imported)"</strong> in the Finance filter to view all historical charts and totals.
          </p>

          {errors.length > 0 && (
            <div className="mt-2 text-xs text-amber-300 space-y-1 max-h-24 overflow-y-auto border-t border-amber-700/50 pt-2">
              <p className="font-semibold">{errors.length} skipped row(s):</p>
              {errors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
