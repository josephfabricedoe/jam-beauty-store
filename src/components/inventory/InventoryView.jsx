import React, { useState } from 'react';
import ShowroomTable from './ShowroomTable';
import StoreroomTable from './StoreroomTable';
import TransferModal from './TransferModal';
import CSVImport from './CSVImport';
import { useAuth } from '../../hooks/useAuth';
import { Store, Warehouse, Upload } from 'lucide-react';

const TABS = [
  { id: 'showroom', label: 'Showroom', icon: Store },
  { id: 'storeroom', label: 'Storeroom', icon: Warehouse },
];

export default function InventoryView() {
  const [tab, setTab] = useState('showroom');
  const [transferProduct, setTransferProduct] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="p-4 space-y-4">
      {/* Tabs + CSV import button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === id ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <a href="/inventory-template.csv" download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-amber-400 text-slate-400 hover:text-amber-300 rounded-xl text-sm transition-colors">
              ↓ Template
            </a>
            <button onClick={() => setShowImport(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-rose-400 text-slate-300 hover:text-white rounded-xl text-sm transition-colors">
              <Upload className="w-4 h-4" /> CSV Import
            </button>
          </div>
        )}
      </div>

      {showImport && isAdmin && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <h3 className="font-medium text-white mb-3">Bulk Import Products</h3>
          <CSVImport />
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        {tab === 'showroom' && <ShowroomTable />}
        {tab === 'storeroom' && <StoreroomTable onTransferClick={setTransferProduct} />}
      </div>

      <TransferModal
        isOpen={!!transferProduct}
        onClose={() => setTransferProduct(null)}
        product={transferProduct}
      />
    </div>
  );
}
