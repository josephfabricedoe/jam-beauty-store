/**
 * Role-Based Access Control (RBAC) System
 * Defines 4 confidentiality and authority tiers:
 * 1. Delivery Person ('delivery'): Delivery logistics & attendance clock-in only
 * 2. Cashier ('cashier' / 'staff'): Delivery + POS + Customers + attendance
 * 3. Manager ('manager'): Finance reports, drawer approvals, inventory, marketing, customers; EXCLUDES Restock/Suppliers & Settings
 * 4. Owner / CEO ('owner' / 'admin'): Full unrestricted master access (Settings, Restock & Suppliers, Staff Finances)
 */

export const ROLES = {
  DELIVERY: 'delivery',
  CASHIER: 'cashier',
  MANAGER: 'manager',
  OWNER: 'owner',
};

// Normalize legacy roles ('admin' -> 'owner', 'staff' -> 'cashier')
export function normalizeRole(role) {
  if (!role) return 'cashier';
  const r = String(role).toLowerCase().trim();
  if (r === 'admin' || r === 'owner' || r === 'ceo' || r === 'superadmin') return 'owner';
  if (r === 'manager' || r === 'supervisor') return 'manager';
  if (r === 'delivery' || r === 'driver' || r === 'dispatch') return 'delivery';
  if (r === 'staff' || r === 'cashier') return 'cashier';
  return 'cashier';
}

export const ROLE_DEFINITIONS = {
  delivery: {
    id: 'delivery',
    label: 'Delivery Dispatch',
    badge: '🚚 Delivery',
    badgeColor: 'bg-amber-900/40 text-amber-300 border-amber-600/40',
    description: 'Lowest Authority: Access to Delivery board & Attendance clock-in only.',
    tier: 1,
  },
  cashier: {
    id: 'cashier',
    label: 'Store Cashier',
    badge: '💳 Cashier',
    badgeColor: 'bg-emerald-900/40 text-emerald-300 border-emerald-600/40',
    description: 'Operational Sales: Access to POS, Sales, Customers, Deliveries & Attendance.',
    tier: 2,
  },
  manager: {
    id: 'manager',
    label: 'Store Manager',
    badge: '👔 Manager',
    badgeColor: 'bg-blue-900/40 text-blue-300 border-blue-600/40',
    description: 'Store Management: Finance reports, shift approvals, Inventory, WhatsApp marketing. Restock, Suppliers & Settings are restricted.',
    tier: 3,
  },
  owner: {
    id: 'owner',
    label: 'Owner / CEO',
    badge: '👑 Owner / CEO',
    badgeColor: 'bg-purple-900/50 text-purple-200 border-purple-500/50',
    description: 'Master Authority: Unrestricted access to Settings, Restock & Suppliers, Staff Management, & Financial controls.',
    tier: 4,
  },
};

// Modules allowed per normalized role
export const ROLE_PERMISSIONS = {
  delivery: ['delivery', 'attendance'],
  cashier:  ['delivery', 'attendance', 'pos', 'customers'],
  manager:  ['delivery', 'attendance', 'pos', 'customers', 'inventory', 'marketing', 'finance'],
  owner:    ['delivery', 'attendance', 'pos', 'customers', 'inventory', 'marketing', 'finance', 'suppliers', 'staff', 'settings'],
};

export function canAccessModule(role, moduleId) {
  const normalized = normalizeRole(role);
  const allowed = ROLE_PERMISSIONS[normalized] || [];
  return allowed.includes(moduleId);
}

export function getDefaultModuleForRole(role) {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case 'delivery':
      return 'delivery';
    case 'cashier':
    case 'manager':
    case 'owner':
    default:
      return 'pos';
  }
}

export function isOwner(role) {
  return normalizeRole(role) === 'owner';
}

export function isManager(role) {
  const norm = normalizeRole(role);
  return norm === 'manager' || norm === 'owner';
}

export function isCashier(role) {
  const norm = normalizeRole(role);
  return norm === 'cashier' || norm === 'manager' || norm === 'owner';
}

export function isDelivery(role) {
  return true; // All roles can see delivery
}
