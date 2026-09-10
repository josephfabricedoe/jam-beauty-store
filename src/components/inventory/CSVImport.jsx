import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { doc, setDoc, serverTimestamp, collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, Boxes } from 'lucide-react';

function findField(row, candidates) {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const matchedKey = keys.find(k => k.trim().toLowerCase() === c.toLowerCase());
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return String(row[matchedKey]).trim();
    }
  }
  return '';
}

export default function CSVImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [newSuppliersCount, setNewSuppliersCount] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f || !f.name.endsWith('.csv')) {
      setError('Please select a valid .csv file.');
      return;
    }
    setError('');
    setDone(false);
    setProgress(0);
    setFile(f);

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data.length) {
          setError('The uploaded CSV file is empty.');
          setFile(null);
          return;
        }
        setHeaders(res.meta.fields || []);
        setPreview(res.data.slice(0, 5));
      },
      error: (err) => {
        setError('Error reading CSV: ' + err.message);
      }
    });
  };

  const handleImport = () => {
    if (!file) return;
    setImporting(true);
    setProgress(0);
    setError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const rows = res.data;
        let count = 0;
        let suppliersCreated = 0;
        const errs = [];

        try {
          // Pre-fetch existing suppliers to avoid duplicates
          const existingSuppliersSnap = await getDocs(collection(db, 'suppliers'));
          const suppliersMap = new Map();
          existingSuppliersSnap.docs.forEach(d => {
            const s = d.data();
            if (s.name) {
              suppliersMap.set(s.name.trim().toLowerCase(), { id: d.id, name: s.name.trim() });
            }
          });

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
              let barcode = findField(row, ['barcode', 'sku', 'sku_number', 'upc', 'code', 'id']);
              const name = findField(row, ['name', 'productName', 'product_name', 'product', 'item', 'description', 'title']);
              const category = findField(row, ['category', 'type', 'group']) || 'Other';
              const supplierRaw = findField(row, ['supplier', 'supplierName', 'supplier_name', 'vendor', 'distributor', 'source']);
              const retailPrice = parseFloat(findField(row, ['retailPrice', 'retail_price', 'retail', 'price', 'rate']).replace(/[^0-9.]/g, '')) || 0;
              const halfDozenPrice = parseFloat(findField(row, ['halfDozenPrice', 'half_dozen_price', 'halfDozen', '6x', 'wholesale_6']).replace(/[^0-9.]/g, '')) || 0;
              const dozenPrice = parseFloat(findField(row, ['dozenPrice', 'dozen_price', 'dozen', '12x', 'wholesale_12']).replace(/[^0-9.]/g, '')) || 0;
              const costPrice = parseFloat(findField(row, ['costPrice', 'cost_price', 'cost', 'purchase_price']).replace(/[^0-9.]/g, '')) || 0;
              const showroomQty = parseInt(findField(row, ['showroomQty', 'showroom_qty', 'showroom', 'stock', 'qty', 'quantity']), 10) || 0;
              const storeroomQty = parseInt(findField(row, ['storeroomQty', 'storeroom_qty', 'storeroom', 'warehouse_qty', 'warehouse']), 10) || 0;
              const reorderTrigger = parseInt(findField(row, ['reorderTrigger', 'reorder_trigger', 'reorder_level', 'min_stock']), 10) || 10;

              if (!name) {
                continue; // skip rows without a product name
              }

              // Auto-harvest Supplier from CSV column
              let supplierId = '';
              let supplierName = '';

              if (supplierRaw) {
                const cleanSupp = supplierRaw.trim();
                const key = cleanSupp.toLowerCase();
                if (suppliersMap.has(key)) {
                  supplierId = suppliersMap.get(key).id;
                  supplierName = suppliersMap.get(key).name;
                } else {
                  // Auto-create supplier in Firestore
                  const newSuppRef = await addDoc(collection(db, 'suppliers'), {
                    name: cleanSupp,
                    code: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
                    contactPerson: '',
                    phone: '',
                    email: '',
                    address: '',
                    terms: 'COD',
                    leadTimeDays: cleanSupp.toLowerCase().includes('china') || cleanSupp.toLowerCase().includes('dubai') ? 28 : 14,
                    active: true,
                    notes: 'Auto-harvested from Inventory CSV upload',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  supplierId = newSuppRef.id;
                  supplierName = cleanSupp;
                  suppliersMap.set(key, { id: supplierId, name: supplierName });
                  suppliersCreated++;
                }
              }

              // If no barcode provided, generate a predictable unique SKU
              if (!barcode) {
                barcode = `SKU-${Date.now().toString().slice(-6)}-${count + 1}`;
              }

              const productData = {
                barcode,
                name,
                category,
                retailPrice,
                halfDozenPrice: halfDozenPrice || (retailPrice * 0.9),
                dozenPrice: dozenPrice || (retailPrice * 0.85),
                costPrice,
                showroomQty,
                storeroomQty,
                reorderTrigger,
                isTester: false,
                isDamaged: false,
                updatedAt: serverTimestamp(),
              };

              if (supplierId) {
                productData.supplierId = supplierId;
                productData.supplierName = supplierName;
              }

              await setDoc(doc(db, 'products', barcode), productData, { merge: true });

              count++;
              setProgress(Math.round((count / rows.length) * 100));
            } catch (e) {
              errs.push(`Row ${i + 1}: ${e.message}`);
            }
          }

          setImporting(false);
          setDone(true);
          setImportedCount(count);
          setNewSuppliersCount(suppliersCreated);
          setFile(null);
          setPreview([]);
        } catch (globalErr) {
          console.error('Import error:', globalErr);
          setError('Import failed: ' + globalErr.message);
          setImporting(false);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Upload products in bulk using any spreadsheet. Headers are matched automatically.
        </p>
        <a
          href="/inventory-template.csv"
          download
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>Download Template CSV</span>
        </a>
      </div>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-600 hover:border-rose-400 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-900/30"
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-300 font-medium">Drag & drop inventory CSV file or <span className="text-rose-400">browse</span></p>
        <p className="text-xs text-slate-500 mt-1">Accepts barcode, product name, category, prices, and showroom/storeroom quantities</p>
      </div>

      {file && (
        <div className="flex items-center gap-2 bg-slate-700/50 rounded-xl px-3.5 py-2.5">
          <FileText className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="text-sm text-white flex-1 truncate font-medium">{file.name}</span>
          <button type="button" onClick={() => { setFile(null); setPreview([]); }} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 flex items-center gap-2 bg-red-900/20 border border-red-800/40 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 font-medium">Preview (First 5 Rows to Import):</p>
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
                      <td key={h} className="px-3 py-2 text-slate-300 whitespace-nowrap">{row[h]}</td>
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
            className="w-full py-3 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-rose-500/20"
          >
            {importing ? `Importing Products (${progress}%)...` : 'Confirm and Import Products'}
          </button>

          {importing && (
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 transition-all rounded-full" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>Successfully imported {importedCount} products into your Inventory!</span>
          </div>
          {newSuppliersCount > 0 && (
            <p className="text-xs text-emerald-400/90 pl-7">
              ⚡ <strong>{newSuppliersCount} new supplier{newSuppliersCount > 1 ? 's' : ''}</strong> were automatically harvested into the <strong>Suppliers</strong> tab. You can now add their phone numbers, locations, and lead times for 1-click restock ordering.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
