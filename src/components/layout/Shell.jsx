import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import CurrencyToggle from '../shared/CurrencyToggle';
import NotificationBell from '../shared/NotificationBell';
import POSView from '../pos/POSView';
import InventoryView from '../inventory/InventoryView';
import FinanceView from '../finance/FinanceView';
import AttendanceView from '../attendance/AttendanceView';
import DeliveryBoard from '../delivery/DeliveryBoard';
import StaffView from '../staff/StaffView';
import SettingsView from '../settings/SettingsView';
import CustomerAccountsView from '../customers/CustomerAccountsView';
import PwaInstallPrompt from '../shared/PwaInstallPrompt';
import { LogOut, ShieldAlert, ShoppingBag } from 'lucide-react';

const MODULE_VIEWS = {
  pos:        POSView,
  inventory:  InventoryView,
  finance:    FinanceView,
  customers:  CustomerAccountsView,
  attendance: AttendanceView,
  delivery:   DeliveryBoard,
  staff:      StaffView,
  settings:   SettingsView,
};

const MODULE_LABELS = {
  pos:        'Point of Sale',
  inventory:  'Inventory Management',
  finance:    'Finance & Reports',
  customers:  'Customer & Salon Accounts',
  attendance: 'Staff Attendance',
  delivery:   'Delivery Logistics',
  staff:      'Staff Management',
  settings:   'Store Settings',
};

const ADMIN_ONLY_MODULES = ['inventory', 'finance', 'staff', 'settings'];

export default function Shell({ onGoToCatalog }) {
  const { activeModule, setActiveModule } = useApp();
  const { userProfile, signOut } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  let ActiveView = MODULE_VIEWS[activeModule] || POSView;

  // Protect Admin-Only modules
  const isBlocked = ADMIN_ONLY_MODULES.includes(activeModule) && !isAdmin;

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <img
            src="/jam-logo-blush.jpg"
            alt="JAM Beauty"
            className="md:hidden w-8 h-8 rounded-full object-cover border border-[#efaa9b]/60 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              {MODULE_LABELS[activeModule] || 'JAM Beauty'}
            </h1>
            <p className="text-[11px] text-[#efaa9b] font-medium hidden sm:block">JAM Beauty Store · Official POS</p>
          </div>
          
          {onGoToCatalog && (
            <button
              type="button"
              onClick={onGoToCatalog}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[#efaa9b] hover:text-white rounded-xl text-xs font-semibold transition-colors"
              title="View Public Customer Storefront"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Storefront</span>
            </button>
          )}

          <CurrencyToggle />
          <NotificationBell />
          <button
            onClick={signOut}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <PwaInstallPrompt />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-4">
          {isBlocked ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Administrator Access Only</h2>
              <p className="text-slate-400 text-sm max-w-md mb-6">
                Inventory adjustments, financial metrics, and settings are restricted to manager and admin accounts.
              </p>
              <button
                onClick={() => setActiveModule('pos')}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Return to Point of Sale
              </button>
            </div>
          ) : (
            <ActiveView />
          )}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
