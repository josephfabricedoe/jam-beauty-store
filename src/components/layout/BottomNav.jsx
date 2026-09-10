import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Users, 
  Truck, 
  HeartHandshake, 
  MessageCircle, 
  Building2,
  Settings
} from 'lucide-react';
import { canAccessModule, normalizeRole } from '../../utils/rbac';

const ALL_NAV_ITEMS = [
  { id: 'pos',        label: 'POS',       icon: ShoppingCart },
  { id: 'delivery',   label: 'Delivery',  icon: Truck },
  { id: 'attendance', label: 'Clock-In',  icon: Users },
  { id: 'customers',  label: 'VIP Accts', icon: HeartHandshake },
  { id: 'inventory',  label: 'Stock',     icon: Package },
  { id: 'finance',    label: 'Finance',   icon: BarChart3 },
  { id: 'marketing',  label: 'Marketing', icon: MessageCircle },
  { id: 'suppliers',  label: 'Suppliers', icon: Building2 },
];

export default function BottomNav() {
  const { activeModule, setActiveModule } = useApp();
  const { userProfile } = useAuth();
  const role = normalizeRole(userProfile?.role);

  // Filter items accessible to this role, take up to 5 for clean mobile display
  const navItems = ALL_NAV_ITEMS.filter(item => canAccessModule(role, item.id)).slice(0, 5);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 safe-bottom md:hidden">
      <div className="flex">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveModule(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors relative ${
              activeModule === id ? 'text-[#efaa9b]' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className={`w-5 h-5 ${activeModule === id ? 'text-[#efaa9b]' : ''}`} />
            <span className="truncate max-w-[64px]">{label}</span>
            {activeModule === id && <div className="absolute bottom-0 w-8 h-0.5 bg-[#efaa9b] rounded-t-full" />}
          </button>
        ))}
      </div>
    </nav>
  );
}

