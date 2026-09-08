import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import StoreInfoForm from './StoreInfoForm';
import WebsiteCmsForm from './WebsiteCmsForm';
import FactoryResetModal from './FactoryResetModal';
import { Settings, Globe, Store, Receipt, ShieldAlert, Trash2, Database } from 'lucide-react';

export default function SettingsView() {
  const { storeSettings } = useApp();
  const [activeTab, setActiveTab] = useState('website'); // 'website' | 'store' | 'system'
  const [resetModalOpen, setResetModalOpen] = useState(false);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#efaa9b]/20 border border-[#efaa9b]/30 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[#efaa9b]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Store Settings & System</h2>
            <p className="text-xs text-slate-400">Manage online catalog, POS configuration, receipts, and system reset</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700 flex-wrap">
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
            <span>Website CMS</span>
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

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'system'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-red-400 hover:text-red-300'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>System Reset</span>
          </button>
        </div>
      </div>

      {activeTab === 'website' && (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-xl">
          <WebsiteCmsForm settings={storeSettings} />
        </div>
      )}

      {activeTab === 'store' && (
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

      {activeTab === 'system' && (
        <div className="space-y-5">
          {/* Danger Zone: Factory Reset Card */}
          <div className="bg-red-950/30 border-2 border-red-800/60 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                  <ShieldAlert className="w-5 h-5" />
                  <h3>Danger Zone: Factory Reset App Data</h3>
                </div>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  Reset your store platform to factory state by wiping transaction logs, sales history, customer debt ledgers, shift handovers, and attendance.
                </p>
                <p className="text-xs text-amber-300 font-semibold pt-1">
                  🔒 Strictly protected: Requires Administrator Email and Password authentication to execute.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset to Factory</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-red-800/40 text-xs">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <p className="font-semibold text-slate-300">Sales & Cash</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Clears receipts, orders & drawer history</p>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <p className="font-semibold text-slate-300">Customer Ledgers</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Clears VIP credit balances & customer debts</p>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <p className="font-semibold text-slate-300">Operational Logs</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Clears shift Z-reports, attendance & dispatches</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Factory Reset Modal */}
      <FactoryResetModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
      />
    </div>
  );
}
