import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { ShoppingCart, Package, BarChart3, Users, Truck, Sparkles, ChevronLeft, LogOut, Settings, UserCog, HeartHandshake, Building2, MessageCircle } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'pos',        label: 'Point of Sale',     icon: ShoppingCart,    roles: ['admin', 'staff'] },
  { id: 'inventory',  label: 'Inventory',          icon: Package,         roles: ['admin'] }, // ADMIN ONLY
  { id: 'suppliers',  label: 'Suppliers & Restock', icon: Building2,      roles: ['admin'] }, // ADMIN ONLY
  { id: 'marketing',  label: 'WhatsApp Marketing', icon: MessageCircle,   roles: ['admin', 'staff'] },
  { id: 'finance',    label: 'Finance & Reports',  icon: BarChart3,       roles: ['admin'] },
  { id: 'customers',  label: 'Customers & VIP Accounts', icon: HeartHandshake,  roles: ['admin', 'staff'] },
  { id: 'attendance', label: 'Attendance',         icon: Users,           roles: ['admin', 'staff'] },
  { id: 'delivery',   label: 'Delivery',           icon: Truck,           roles: ['admin', 'staff'] },
  { id: 'staff',      label: 'Staff Management',   icon: UserCog,         roles: ['admin'] },
];

const BOTTOM_ITEMS = [
  { id: 'settings',   label: 'Settings',          icon: Settings,     roles: ['admin'] },
];

function NavButton({ id, label, icon: Icon, active, isOpen, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {isOpen && <span className="truncate">{label}</span>}
    </button>
  );
}

export default function Sidebar() {
  const { activeModule, setActiveModule, isSidebarOpen, toggleSidebar } = useApp();
  const { userProfile, signOut } = useAuth();
  const role = userProfile?.role || 'staff';

  const filtered = NAV_ITEMS.filter(i => i.roles.includes(role));
  const bottomFiltered = BOTTOM_ITEMS.filter(i => i.roles.includes(role));

  return (
    <aside className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ${isSidebarOpen ? 'w-56' : 'w-16'}`}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 p-4 border-b border-slate-800">
        <img
          src="/jam-logo-blush.jpg"
          alt="JAM Beauty Store"
          className="flex-shrink-0 w-9 h-9 rounded-full object-cover border border-[#efaa9b]/50 shadow-sm"
        />
        {isSidebarOpen && (
          <div className="min-w-0">
            <span className="font-extrabold text-white text-sm tracking-wide block leading-tight">JAM BEAUTY</span>
            <span className="text-[10px] text-[#efaa9b] font-medium uppercase tracking-wider block">Store System</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${!isSidebarOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {filtered.map(item => (
          <NavButton
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            active={activeModule === item.id}
            isOpen={isSidebarOpen}
            onClick={setActiveModule}
          />
        ))}
      </nav>

      {/* Bottom navigation */}
      <div className="p-2 border-t border-slate-800 space-y-1">
        {bottomFiltered.map(item => (
          <NavButton
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            active={activeModule === item.id}
            isOpen={isSidebarOpen}
            onClick={setActiveModule}
          />
        ))}

        {/* User badge */}
        <div className={`flex items-center gap-2 px-3 py-2 ${!isSidebarOpen ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 flex-shrink-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white">{(userProfile?.displayName || userProfile?.email || 'U')[0].toUpperCase()}</span>
          </div>
          {isSidebarOpen && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{userProfile?.displayName || userProfile?.email}</p>
              <p className="text-xs text-slate-500 capitalize">{userProfile?.role}</p>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {isSidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
