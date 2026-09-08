import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { ShoppingCart, Package, BarChart3, Users, Truck, HeartHandshake } from 'lucide-react';

const ALL_NAV_ITEMS = [
  { id: 'pos',        label: 'POS',       icon: ShoppingCart,    adminOnly: false },
  { id: 'customers',  label: 'VIP Accts', icon: HeartHandshake,  adminOnly: false },
  { id: 'attendance', label: 'Staff',     icon: Users,           adminOnly: false },
  { id: 'delivery',   label: 'Delivery',  icon: Truck,           adminOnly: false },
  { id: 'inventory',  label: 'Stock',     icon: Package,         adminOnly: true },
  { id: 'finance',    label: 'Finance',   icon: BarChart3,       adminOnly: true },
];

export default function BottomNav() {
  const { activeModule, setActiveModule } = useApp();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  const navItems = ALL_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 safe-bottom md:hidden">
      <div className="flex">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveModule(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors relative ${
              activeModule === id ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className={`w-5 h-5 ${activeModule === id ? 'text-rose-400' : ''}`} />
            <span>{label}</span>
            {activeModule === id && <div className="absolute bottom-0 w-8 h-0.5 bg-rose-400 rounded-t-full" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
