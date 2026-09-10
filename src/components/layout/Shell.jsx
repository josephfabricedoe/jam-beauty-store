import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import CurrencyToggle from '../shared/CurrencyToggle';
import NotificationBell from '../shared/NotificationBell';
import POSView from '../pos/POSView';
import InventoryView from '../inventory/InventoryView';
import SuppliersView from '../suppliers/SuppliersView';
import MarketingView from '../marketing/MarketingView';
import FinanceView from '../finance/FinanceView';
import AttendanceView from '../attendance/AttendanceView';
import DeliveryBoard from '../delivery/DeliveryBoard';
import StaffView from '../staff/StaffView';
import SettingsView from '../settings/SettingsView';
import CustomerAccountsView from '../customers/CustomerAccountsView';
import PwaInstallPrompt from '../shared/PwaInstallPrompt';
import { 
  LogOut, 
  ShieldAlert, 
  ShoppingBag, 
  Menu, 
  X, 
  ShoppingCart, 
  Package, 
  Building2, 
  MessageCircle, 
  BarChart3, 
  HeartHandshake, 
  Users, 
  Truck, 
  UserCog, 
  Settings 
} from 'lucide-react';

const MODULE_VIEWS = {
  pos:        POSView,
  inventory:  InventoryView,
  suppliers:  SuppliersView,
  marketing:  MarketingView,
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
  suppliers:  'Suppliers & Restocking',
  marketing:  'WhatsApp Marketing',
  finance:    'Finance & Reports',
  customers:  'Customers & VIP Accounts',
  attendance: 'Staff Attendance',
  delivery:   'Delivery Logistics',
  staff:      'Staff Management',
  settings:   'Store Settings',
};

const ALL_MOBILE_MODULES = [
  { id: 'pos',        label: 'Point of Sale',     icon: ShoppingCart,    adminOnly: false },
  { id: 'marketing',  label: 'WhatsApp Marketing', icon: MessageCircle,   adminOnly: false },
  { id: 'customers',  label: 'Customers & VIP',   icon: HeartHandshake,  adminOnly: false },
  { id: 'inventory',  label: 'Inventory Stock',   icon: Package,         adminOnly: true },
  { id: 'suppliers',  label: 'Suppliers & Restock', icon: Building2,      adminOnly: true },
  { id: 'finance',    label: 'Finance & Reports',  icon: BarChart3,       adminOnly: true },
  { id: 'delivery',   label: 'Delivery Logistics', icon: Truck,           adminOnly: false },
  { id: 'attendance', label: 'Staff Attendance',  icon: Users,           adminOnly: false },
  { id: 'staff',      label: 'Staff Management',   icon: UserCog,         adminOnly: true },
  { id: 'settings',   label: 'Store Settings',     icon: Settings,        adminOnly: true },
];

const ADMIN_ONLY_MODULES = ['inventory', 'suppliers', 'finance', 'staff', 'settings'];

export default function Shell({ onGoToCatalog }) {
  const { activeModule, setActiveModule } = useApp();
  const { userProfile, signOut } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  let ActiveView = MODULE_VIEWS[activeModule] || POSView;

  // Protect Admin-Only modules
  const isBlocked = ADMIN_ONLY_MODULES.includes(activeModule) && !isAdmin;

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex-shrink-0 flex items-center gap-2.5 px-3 sm:px-4 py-3 bg-slate-900 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <img
            src="/jam-logo-blush.jpg"
            alt="JAM Beauty"
            className="w-8 h-8 rounded-full object-cover border border-[#efaa9b]/60 flex-shrink-0"
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

      {/* Mobile slide-over navigation drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[80vw] bg-slate-900 border-r border-slate-800 h-full flex flex-col p-4 shadow-2xl z-10">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <img
                  src="/jam-logo-blush.jpg"
                  alt="JAM Beauty"
                  className="w-9 h-9 rounded-full object-cover border border-[#efaa9b]/50"
                />
                <div>
                  <span className="font-extrabold text-white text-sm block leading-tight">JAM BEAUTY</span>
                  <span className="text-[10px] text-[#efaa9b] font-medium uppercase tracking-wider block">Store System</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 py-3 space-y-1 overflow-y-auto">
              {ALL_MOBILE_MODULES.filter(m => !m.adminOnly || isAdmin).map(item => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveModule(item.id);
                      setMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 flex items-center justify-center font-bold text-xs text-white">
                  {(userProfile?.displayName || userProfile?.email || 'U')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{userProfile?.displayName || userProfile?.email}</p>
                  <p className="text-[11px] text-slate-500 capitalize">{userProfile?.role}</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
