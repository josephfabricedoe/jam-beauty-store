import React from 'react';
import { useApp } from '../../contexts/AppContext';
import StoreInfoForm from './StoreInfoForm';
import { Settings } from 'lucide-react';

export default function SettingsView() {
  const { storeSettings } = useApp();
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
          <Settings className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Store Settings</h2>
          <p className="text-xs text-slate-500">Configure store info, receipt, and currency</p>
        </div>
      </div>
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
        <StoreInfoForm settings={storeSettings} />
      </div>
      {storeSettings?.storeName && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Receipt Preview</h3>
          <div className="font-mono text-xs bg-white text-black rounded-xl p-4 max-w-xs mx-auto">
            {storeSettings.logoUrl && (
              <img src={storeSettings.logoUrl} alt="logo" className="h-10 mx-auto mb-2 object-contain" />
            )}
            <div className="text-center font-bold text-sm">{storeSettings.storeName}</div>
            {storeSettings.address && <div className="text-center text-gray-500 text-xs">{storeSettings.address}</div>}
            {storeSettings.phone && <div className="text-center text-gray-500 text-xs">Tel: {storeSettings.phone}</div>}
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="flex justify-between"><span>Sample Product x2</span><span>$10.00</span></div>
            <div className="border-t border-dashed border-gray-300 my-1 pt-1 font-bold flex justify-between">
              <span>TOTAL</span><span>$10.00</span>
            </div>
            {storeSettings.taxRate > 0 && (
              <div className="flex justify-between text-gray-500"><span>Tax ({storeSettings.taxRate}%)</span><span>${(10 * storeSettings.taxRate / 100).toFixed(2)}</span></div>
            )}
            <div className="text-center text-gray-400 mt-2 text-xs">{storeSettings.receiptFooter}</div>
          </div>
        </div>
      )}
    </div>
  );
}
