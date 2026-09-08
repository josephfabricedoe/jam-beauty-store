import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import StoreInfoForm from './StoreInfoForm';
import WebsiteCmsForm from './WebsiteCmsForm';
import { Settings, Globe, Store, Receipt } from 'lucide-react';

export default function SettingsView() {
  const { storeSettings } = useApp();
  const [activeTab, setActiveTab] = useState('website'); // 'website' | 'store'

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#efaa9b]/20 border border-[#efaa9b]/30 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#efaa9b]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Store Settings & Website CMS</h2>
            <p className="text-xs text-slate-400">Manage your online catalog, WhatsApp orders, receipts, and currency</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('website')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'website'
                ? 'bg-[#efaa9b] text-[#45150b] shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Website & Catalog CMS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'store'
                ? 'bg-[#efaa9b] text-[#45150b] shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>POS & Receipts</span>
          </button>
        </div>
      </div>

      {activeTab === 'website' ? (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-xl">
          <WebsiteCmsForm settings={storeSettings} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-xl">
            <StoreInfoForm settings={storeSettings} />
          </div>

          {storeSettings?.storeName && (
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-[#efaa9b]" />
                <span>Thermal Receipt Preview</span>
              </h3>
              <div className="font-mono text-xs bg-white text-black rounded-xl p-4 max-w-xs mx-auto shadow-md">
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
      )}
    </div>
  );
}
