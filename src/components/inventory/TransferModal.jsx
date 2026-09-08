import React, { useState } from 'react';
import Modal from '../shared/Modal';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ArrowRight, AlertCircle } from 'lucide-react';

export default function TransferModal({ isOpen, onClose, product }) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!product) return null;

  const maxQty = product.storeroomQty || 0;

  const handleTransfer = async () => {
    if (qty < 1 || qty > maxQty) { setError(`Transfer qty must be 1–${maxQty}`); return; }
    setLoading(true); setError('');
    try {
      const ref = doc(db, 'products', product.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Product not found');
        const data = snap.data();
        const newStoreroom = (data.storeroomQty || 0) - qty;
        const newShowroom = (data.showroomQty || 0) + qty;
        if (newStoreroom < 0) throw new Error('Insufficient storeroom stock');
        tx.update(ref, { storeroomQty: newStoreroom, showroomQty: newShowroom });
      });
      onClose();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer to Showroom"
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">Cancel</button>
          <button onClick={handleTransfer} disabled={loading || maxQty === 0} className="flex-1 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1">
            {loading ? 'Transferring...' : <><ArrowRight className="w-4 h-4" /> Transfer</>}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-700/50 rounded-xl p-3">
          <p className="font-medium text-white">{product.name}</p>
          <p className="text-xs text-slate-500">{product.barcode}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/30 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400">Storeroom Stock</p>
            <p className="text-2xl font-bold text-white">{product.storeroomQty || 0}</p>
          </div>
          <div className="bg-slate-700/30 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400">Showroom Stock</p>
            <p className="text-2xl font-bold text-rose-300">{product.showroomQty || 0}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Quantity to Transfer</label>
          <input
            type="number" min={1} max={maxQty} value={qty} onChange={e => setQty(Number(e.target.value))}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-400"
          />
          {maxQty === 0 && <p className="text-xs text-yellow-400 mt-1">No stock available in storeroom.</p>}
        </div>
        {error && <p className="text-sm text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
      </div>
    </Modal>
  );
}
