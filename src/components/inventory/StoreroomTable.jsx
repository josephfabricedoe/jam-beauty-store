import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import { ArrowRight } from 'lucide-react';

export default function StoreroomTable({ onTransferClick }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { format } = useCurrency();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => (p.storeroomQty || 0) > 0 || p.reorderTrigger));
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <div className="text-slate-500 text-sm p-4">Loading...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-700">
            <th className="text-left px-3 py-2">Product</th>
            <th className="text-right px-3 py-2">Storeroom Qty</th>
            <th className="text-right px-3 py-2">Reorder Trigger</th>
            <th className="text-center px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
              <td className="px-3 py-2">
                <div className="font-medium text-white">{p.name}</div>
                <div className="text-xs text-slate-500">{p.barcode}</div>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`font-semibold ${(p.storeroomQty || 0) <= (p.reorderTrigger || 10) ? 'text-yellow-400' : 'text-white'}`}>
                  {p.storeroomQty || 0}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-slate-400">{p.reorderTrigger || '—'}</td>
              <td className="px-3 py-2">
                <div className="flex justify-center">
                  <button
                    onClick={() => onTransferClick(p)}
                    disabled={(p.storeroomQty || 0) === 0}
                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="w-3 h-3" /> Transfer
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan={4} className="text-center text-slate-500 py-8 text-sm">No storeroom stock found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
