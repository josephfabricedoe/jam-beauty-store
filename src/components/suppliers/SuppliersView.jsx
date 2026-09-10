import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  increment,
  serverTimestamp, 
  addDoc 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import SupplierModal from './SupplierModal';
import RestockOrderModal from './RestockOrderModal';
import Modal from '../shared/Modal';
import {
  Truck,
  Package,
  Clock,
  RotateCcw,
  Search,
  Plus,
  Download,
  Upload,
  Edit2,
  Trash2,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  FileSpreadsheet,
  Boxes,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ClipboardList,
  Ship,
  Globe,
  Eye,
  Camera,
  FileText,
  X
} from 'lucide-react';

function getSupplierOrigin(supplier) {
  if (!supplier) return { flag: '🌐', name: 'International', transit: '2-4 wks', weeksMin: 2, weeksMax: 4, note: 'Lead time: 2-4 wks' };
  const text = `${supplier.address || ''} ${supplier.notes || ''} ${supplier.name || ''}`.toLowerCase();
  if (text.includes('china') || text.includes('guangzhou') || text.includes('yiwu')) {
    return { flag: '🇨🇳', name: 'China', transit: '3-5 wks', weeksMin: 3, weeksMax: 5, note: 'Packing ~1 wk · Cargo shipping to Liberia ~1 mo' };
  }
  if (text.includes('dubai') || text.includes('uae')) {
    return { flag: '🇦🇪', name: 'Dubai', transit: '3-5 wks', weeksMin: 3, weeksMax: 5, note: 'Packing ~1 wk · Cargo shipping to Liberia ~1 mo' };
  }
  if (text.includes('nigeria') || text.includes('lagos')) {
    return { flag: '🇳🇬', name: 'Nigeria', transit: '1-2 wks', weeksMin: 1, weeksMax: 2, note: 'Regional transit ~1-2 wks' };
  }
  if (text.includes('ghana') || text.includes('accra')) {
    return { flag: '🇬🇭', name: 'Ghana', transit: '1-2 wks', weeksMin: 1, weeksMax: 2, note: 'Regional transit ~1-2 wks' };
  }
  if (text.includes('ivory') || text.includes('abidjan') || text.includes('côte')) {
    return { flag: '🇨🇮', name: 'Ivory Coast', transit: '1-2 wks', weeksMin: 1, weeksMax: 2, note: 'Border transport ~1 wk' };
  }
  return { flag: '🌐', name: 'International', transit: '2-4 wks', weeksMin: 2, weeksMax: 4, note: 'Lead time: 2-4 wks' };
}

export default function SuppliersView() {
  const { format } = useCurrency();

  // Active view tab: 'directory' | 'restock' | 'orders'
  const [viewTab, setViewTab] = useState('directory');

  // Firestore live collections
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [restockOrders, setRestockOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search state
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'deactivated' | 'all'
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedSupplierForEdit, setSelectedSupplierForEdit] = useState(null);

  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedSupplierForRestock, setSelectedSupplierForRestock] = useState(null);
  const [prefilledRestockItems, setPrefilledRestockItems] = useState([]);

  // Orders pipeline & Receipt Viewer state
  const [orderFilter, setOrderFilter] = useState('all'); // 'all' | 'in_transit' | 'received'
  const [viewReceiptModal, setViewReceiptModal] = useState(null);
  const [receivingOrderId, setReceivingOrderId] = useState(null);

  // 1-Click Receive Shipment into Monrovia Storeroom
  const handleReceiveOrder = async (order) => {
    if (!window.confirm(`Confirm Monrovia store arrival for ${order.poNumber}?\n\nThis will increment ${order.totalUnits || 0} units directly into your Storeroom inventory.`)) {
      return;
    }
    setReceivingOrderId(order.id);
    try {
      for (const it of (order.items || [])) {
        if (it.productId) {
          await updateDoc(doc(db, 'products', it.productId), {
            storeroomQty: increment(it.orderQty || 0),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await updateDoc(doc(db, 'restockOrders', order.id), {
        status: 'received',
        receivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert(`Order ${order.poNumber} successfully received into Storeroom!`);
    } catch (err) {
      console.error('Error receiving order:', err);
      alert('Failed to receive order: ' + err.message);
    } finally {
      setReceivingOrderId(null);
    }
  };

  // CSV Import file input ref
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState('');

  // Subscribe to Firestore collections
  useEffect(() => {
    setLoading(true);

    const unsubSuppliers = onSnapshot(
      collection(db, 'suppliers'),
      (snap) => {
        setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn('Suppliers listener notice:', err);
        setLoading(false);
      }
    );

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.warn('Products listener notice:', err);
      }
    );

    const unsubOrders = onSnapshot(
      collection(db, 'restockOrders'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setRestockOrders(list);
      },
      (err) => {
        console.warn('Restock orders listener notice:', err);
      }
    );

    return () => {
      unsubSuppliers();
      unsubProducts();
      unsubOrders();
    };
  }, []);

  // Compute stats matching the screenshot cards
  const stats = useMemo(() => {
    const activeSuppliersList = suppliers.filter(s => s.active !== false);
    const deactivatedSuppliersList = suppliers.filter(s => s.active === false);

    // Count suppliers that have linked products in catalog
    const suppliersWithItemsSet = new Set(
      products
        .filter(p => p.supplierId)
        .map(p => p.supplierId)
    );
    const suppliersWithLinkedItemsCount = activeSuppliersList.filter(s =>
      suppliersWithItemsSet.has(s.id)
    ).length;

    // Average lead time
    const activeWithLeadTime = activeSuppliersList.filter(s => s.leadTimeDays != null && s.leadTimeDays > 0);
    const avgLeadTime = activeWithLeadTime.length > 0
      ? (activeWithLeadTime.reduce((sum, s) => sum + Number(s.leadTimeDays), 0) / activeWithLeadTime.length).toFixed(1)
      : '—';

    const needsInfoCount = activeSuppliersList.filter(s => !s.phone && !s.email).length;

    return {
      activeCount: activeSuppliersList.length,
      linkedCount: suppliersWithLinkedItemsCount,
      avgLeadTime,
      deactivatedCount: deactivatedSuppliersList.length,
      totalCount: suppliers.length,
      needsInfoCount,
    };
  }, [suppliers, products]);

  // Map product counts per supplier
  const supplierProductCountMap = useMemo(() => {
    const map = {};
    products.forEach(p => {
      if (p.supplierId) {
        map[p.supplierId] = (map[p.supplierId] || 0) + 1;
      }
    });
    return map;
  }, [products]);

  // Low stock products (< reorderTrigger)
  const lowStockProducts = useMemo(() => {
    return products.filter(p => {
      const totalStock = (p.showroomQty || 0) + (p.storeroomQty || 0);
      return totalStock <= (p.reorderTrigger || 10) && p.reorderTrigger !== 0;
    });
  }, [products]);

  // Lead-Time-Aware Restock Forecasting
  // Products nearing safety threshold whose suppliers have 3-5 weeks transit from China/Dubai/etc.
  const leadTimeAlertProducts = useMemo(() => {
    return products.filter(p => {
      const totalStock = (p.showroomQty || 0) + (p.storeroomQty || 0);
      if (p.reorderTrigger === 0) return false;
      const supplier = suppliers.find(s => s.id === p.supplierId);
      const origin = getSupplierOrigin(supplier);
      const trigger = p.reorderTrigger || 10;
      
      // Overseas suppliers with >= 3 weeks lead time require an advance safety buffer
      const threshold = origin.weeksMin >= 3 ? Math.max(Math.ceil(trigger * 1.5), 15) : trigger;
      return totalStock <= threshold;
    });
  }, [products, suppliers]);

  const [restockSubTab, setRestockSubTab] = useState('all'); // 'all' | 'lead_time'

  // Filtered suppliers list
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const isActive = s.active !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'deactivated' && isActive) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = (s.name || '').toLowerCase().includes(query);
        const matchCode = (s.code || '').toLowerCase().includes(query);
        const matchContact = (s.contactPerson || '').toLowerCase().includes(query);
        const matchPhone = (s.phone || '').toLowerCase().includes(query);
        const matchEmail = (s.email || '').toLowerCase().includes(query);
        return matchName || matchCode || matchContact || matchPhone || matchEmail;
      }

      return true;
    });
  }, [suppliers, statusFilter, searchTerm]);

  // Toggle supplier active/deactivated
  const handleToggleActive = async (supplier) => {
    const newStatus = supplier.active === false ? true : false;
    try {
      await updateDoc(doc(db, 'suppliers', supplier.id), {
        active: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error toggling supplier status:', err);
      alert('Failed to update status: ' + err.message);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (suppliers.length === 0) {
      alert('No suppliers to export.');
      return;
    }

    const headers = ['Supplier Name', 'Code', 'Contact Person', 'Phone', 'Email', 'Payment Terms', 'Lead Time (Days)', 'Active', 'Notes'];
    const rows = suppliers.map(s => [
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.code || '').replace(/"/g, '""')}"`,
      `"${(s.contactPerson || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.email || '').replace(/"/g, '""')}"`,
      `"${(s.terms || '').replace(/"/g, '""')}"`,
      s.leadTimeDays || 0,
      s.active !== false ? 'Active' : 'Deactivated',
      `"${(s.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jam_beauty_suppliers_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import CSV
  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          alert('CSV file is empty or missing headers.');
          return;
        }

        let importedCount = 0;
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
          if (parts[0]) {
            const supplierData = {
              name: parts[0],
              code: parts[1] || `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
              contactPerson: parts[2] || '',
              phone: parts[3] || '',
              email: parts[4] || '',
              terms: parts[5] || 'Cash on Delivery (COD)',
              leadTimeDays: parseInt(parts[6], 10) || 5,
              active: parts[7] ? !parts[7].toLowerCase().includes('deactiv') : true,
              notes: parts[8] || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await addDoc(collection(db, 'suppliers'), supplierData);
            importedCount++;
          }
        }

        setImportStatus(`Successfully imported ${importedCount} suppliers!`);
        setTimeout(() => setImportStatus(''), 4000);
      } catch (err) {
        console.error('Failed to import CSV:', err);
        alert('Failed to parse CSV file: ' + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-3 sm:p-5 max-w-6xl mx-auto space-y-4">
      {/* Top Action Header (Matching tenantvolt.com layout) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Suppliers</h1>
          {lowStockProducts.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
              <AlertTriangle className="w-3 h-3" />
              {lowStockProducts.length} low stock items to reorder
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>

          {/* Import CSV */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Import CSV</span>
          </button>

          {/* New Supplier */}
          <button
            type="button"
            onClick={() => {
              setSelectedSupplierForEdit(null);
              setIsSupplierModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-rose-950/40 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New supplier</span>
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* 4 Metric Cards (Matching tenantvolt.com exact layout and icons) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Active suppliers */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <Truck className="w-6 h-6 text-rose-500 mb-2" />
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {stats.activeCount}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              Active suppliers
            </div>
          </div>
        </div>

        {/* 2. Suppliers with linked catalog items */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <Package className="w-6 h-6 text-rose-500 mb-2" />
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {stats.linkedCount}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              Suppliers with linked catalog items
            </div>
          </div>
        </div>

        {/* 3. Avg. lead time (days) */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <Clock className="w-6 h-6 text-rose-500 mb-2" />
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {stats.avgLeadTime}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              Avg. lead time (days)
            </div>
          </div>
        </div>

        {/* 4. Deactivated — restorable anytime */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <RotateCcw className="w-6 h-6 text-rose-500 mb-2" />
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {stats.deactivatedCount}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              Deactivated — restorable anytime
            </div>
          </div>
        </div>
      </div>

      {/* Main Subtabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewTab('directory')}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              viewTab === 'directory'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Supplier Directory
          </button>

          <button
            type="button"
            onClick={() => setViewTab('restock')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              viewTab === 'restock'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4 text-rose-400" />
            <span>Restock Procedures</span>
            {lowStockProducts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-bold">
                {lowStockProducts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setViewTab('orders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
              viewTab === 'orders'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-slate-400" />
            <span>Orders History ({restockOrders.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: SUPPLIER DIRECTORY */}
      {viewTab === 'directory' && (
        <div className="space-y-3">
          {stats.needsInfoCount > 0 && (
            <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>{stats.needsInfoCount} supplier{stats.needsInfoCount > 1 ? 's' : ''}</strong> auto-created from CSV inventory upload need contact details (Phone/WhatsApp, location, email).
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Click <strong>"+ Add Info"</strong> on any row to complete profile for 1-click ordering.
              </span>
            </div>
          )}

          {/* Status Filter Tabs & Search Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-3">
            {/* Filter pills matching screenshot */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Active ({stats.activeCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('deactivated')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === 'deactivated'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Deactivated ({stats.deactivatedCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({stats.totalCount})
              </button>
            </div>

            {/* Search Input matching screenshot */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, code, contact or email"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Suppliers Table matching screenshot columns: Supplier, Contact, Terms, Lead time, Items, Active, Actions */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Terms</th>
                    <th className="px-4 py-3">Lead time</th>
                    <th className="px-4 py-3 text-center">Items</th>
                    <th className="px-4 py-3 text-center">Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        {loading ? 'Loading suppliers directory...' : 'No suppliers found matching current filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((supplier) => {
                      const isActive = supplier.active !== false;
                      const itemCount = supplierProductCountMap[supplier.id] || 0;
                      const origin = getSupplierOrigin(supplier);

                      return (
                        <tr key={supplier.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Supplier Name & Origin Flag */}
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base flex-shrink-0" title={origin.name}>{origin.flag}</span>
                              <span className="font-semibold text-white truncate max-w-xs">{supplier.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono">{supplier.code || '—'}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium border border-slate-700">
                                {origin.name} · {origin.transit}
                              </span>
                            </div>
                            {supplier.address && (
                              <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">{supplier.address}</div>
                            )}
                          </td>

                          {/* Contact Details */}
                          <td className="px-4 py-3 text-slate-300">
                            {supplier.contactPerson && (
                              <div className="font-medium text-slate-200">{supplier.contactPerson}</div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {supplier.phone}
                              </div>
                            )}
                            {supplier.email && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Mail className="w-3 h-3 text-slate-500" />
                                {supplier.email}
                              </div>
                            )}
                            {!supplier.contactPerson && !supplier.phone && !supplier.email && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSupplierForEdit(supplier);
                                  setIsSupplierModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-lg transition-colors font-semibold"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>+ Add Info (Phone/Location)</span>
                              </button>
                            )}
                          </td>

                          {/* Terms */}
                          <td className="px-4 py-3 text-slate-300">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700/80 text-amber-300/90 text-[11px] font-medium">
                              {supplier.terms || 'COD'}
                            </span>
                          </td>

                          {/* Lead Time */}
                          <td className="px-4 py-3 text-slate-300">
                            {supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : origin.transit}
                          </td>

                          {/* Linked Items */}
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-[11px]">
                              {itemCount}
                            </span>
                          </td>

                          {/* Active toggle switch */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(supplier)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isActive ? 'bg-rose-500' : 'bg-slate-700'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  isActive ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          {/* Actions: 1-Click Restock */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1-Click Fast Restock Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSupplierForRestock(supplier);
                                  setPrefilledRestockItems([]);
                                  setIsRestockModalOpen(true);
                                }}
                                title="Order Restock from this Supplier"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                              >
                                <Boxes className="w-3.5 h-3.5" />
                                <span>⚡ Restock</span>
                              </button>

                              {/* Edit Supplier */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSupplierForEdit(supplier);
                                  setIsSupplierModalOpen(true);
                                }}
                                title="Edit Supplier"
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: RESTOCK PROCEDURES & LOW-STOCK DASHBOARD */}
      {viewTab === 'restock' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Automated Restock & Lead-Time Forecasting
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Factor in supplier transit times (China/Dubai: 3–5 weeks; West Africa: 1–2 weeks) to restock before stockouts occur.
              </p>
            </div>

            <button
              type="button"
              disabled={(restockSubTab === 'lead_time' ? leadTimeAlertProducts : lowStockProducts).length === 0}
              onClick={() => {
                setSelectedSupplierForRestock(null);
                setPrefilledRestockItems(restockSubTab === 'lead_time' ? leadTimeAlertProducts : lowStockProducts);
                setIsRestockModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors"
            >
              <Boxes className="w-4 h-4" />
              Reorder Selected ({ (restockSubTab === 'lead_time' ? leadTimeAlertProducts : lowStockProducts).length })
            </button>
          </div>

          {/* Lead-Time and Reorder Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRestockSubTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  restockSubTab === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Below Minimum Trigger ({lowStockProducts.length})
              </button>

              <button
                type="button"
                onClick={() => setRestockSubTab('lead_time')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  restockSubTab === 'lead_time'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                <Ship className="w-3.5 h-3.5 text-amber-400" />
                <span>Lead-Time Critical · Order Now ({leadTimeAlertProducts.length})</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500 pr-2">
              Showing {(restockSubTab === 'lead_time' ? leadTimeAlertProducts : lowStockProducts).length} items
            </span>
          </div>

          {/* Lead-Time Guidance Banner when viewing lead_time */}
          {restockSubTab === 'lead_time' && (
            <div className="p-3.5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl flex items-start gap-3 text-xs text-slate-300 animate-in fade-in">
              <Ship className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-bold block mb-0.5">International Transit Lead-Time Safeguard:</strong>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Suppliers in China & Dubai require ~1 week for packing and ~3–5 weeks cargo freight to Monrovia. Waiting until stock reaches 0 guarantees 1 month of empty shelves. These products have crossed their <strong>advance safety reorder buffer</strong> and should be ordered now.
                </p>
              </div>
            </div>
          )}

          {/* Low Stock Items Grid/Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Supplier Origin</th>
                    <th className="px-3 py-3 text-center">Showroom</th>
                    <th className="px-3 py-3 text-center">Storeroom</th>
                    <th className="px-3 py-3 text-center">Total Stock</th>
                    <th className="px-3 py-3 text-center">Reorder Trigger</th>
                    <th className="px-4 py-3 text-right">Cost Price</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(restockSubTab === 'lead_time' ? leadTimeAlertProducts : lowStockProducts).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-emerald-400">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                        <p className="font-semibold">All inventory items are well-stocked!</p>
                        <p className="text-xs text-slate-500 mt-1">No products currently sit below their reorder triggers.</p>
                      </td>
                    </tr>
                  ) : (
                    (restockSubTab === 'lead_time' ? leadTimeAlertProducts : lowStockProducts).map(p => {
                      const totalStock = (p.showroomQty || 0) + (p.storeroomQty || 0);
                      const isZero = totalStock === 0;
                      const supplier = suppliers.find(s => s.id === p.supplierId);
                      const origin = getSupplierOrigin(supplier);
                      const isLeadTimeAlert = origin.weeksMin >= 3 && totalStock > (p.reorderTrigger || 10);

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {isLeadTimeAlert && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Order Ahead
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.barcode || p.sku || p.id}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            <div className="flex items-center gap-1.5 font-medium text-xs">
                              <span>{origin.flag}</span>
                              <span className="truncate max-w-[130px]">{supplier?.name || origin.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Transit: <strong className="text-slate-200">{origin.transit}</strong>
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center text-slate-300">
                            {p.showroomQty || 0}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-300">
                            {p.storeroomQty || 0}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              isZero 
                                ? 'bg-red-500/30 text-red-300 border border-red-500/50' 
                                : totalStock <= (p.reorderTrigger || 10)
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}>
                              {totalStock}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-semibold text-slate-400">
                            {p.reorderTrigger || 10}
                          </td>
                          <td className="px-4 py-3 text-right text-[#efaa9b] font-medium">
                            {format(p.costPrice || 0)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSupplierForRestock(supplier || null);
                                  setPrefilledRestockItems([p]);
                                  setIsRestockModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                              >
                                Restock Item
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`Stop restocking "${p.name}"?\n\nThis will set its minimum reorder trigger to 0 so it will never appear under 'Needs Restock' again.`)) {
                                    await updateDoc(doc(db, 'products', p.id), { reorderTrigger: 0, updatedAt: serverTimestamp() });
                                  }
                                }}
                                title="Stop Restocking (Sets reorder trigger to 0)"
                                className="px-2 py-1 bg-slate-800 hover:bg-amber-600 text-slate-400 hover:text-white rounded-lg text-[11px] font-medium transition-colors border border-slate-700"
                              >
                                Stop Restocking
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`⚠️ PERMANENTLY DELETE "${p.name}" from your store catalog?\n\nThis will remove it completely from Showroom, Storeroom, and Reports.`)) {
                                    await deleteDoc(doc(db, 'products', p.id));
                                  }
                                }}
                                title="Delete item permanently from catalog"
                                className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: PURCHASE ORDERS & OVERSEAS LOGISTICS PIPELINE */}
      {viewTab === 'orders' && (() => {
        const inTransitList = restockOrders.filter(o => o.status === 'in_transit');
        const receivedList = restockOrders.filter(o => o.status === 'received');
        const filteredOrders = orderFilter === 'in_transit' 
          ? inTransitList 
          : orderFilter === 'received' 
            ? receivedList 
            : restockOrders;

        return (
          <div className="space-y-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Ship className="w-5 h-5 text-rose-400" />
                  International Logistics & Restock Orders
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track overseas shipments in transit from Dubai, China, Nigeria, Ghana, and Ivory Coast. Receive into storeroom upon Monrovia delivery.
                </p>
              </div>

              {/* Order Status Filters */}
              <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setOrderFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    orderFilter === 'all'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({restockOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOrderFilter('in_transit')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    orderFilter === 'in_transit'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Ship className="w-3.5 h-3.5 text-amber-400" />
                  <span>In Transit ({inTransitList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderFilter('received')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    orderFilter === 'received'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Received ({receivedList.length})</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">PO & Origin Hub</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3 text-center">Items / Units</th>
                      <th className="px-4 py-3 text-right">Total Outflow</th>
                      <th className="px-4 py-3 text-center">Payment & Slip</th>
                      <th className="px-4 py-3 text-center">Transit Status</th>
                      <th className="px-4 py-3 text-right">Monrovia Receiving</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          {orderFilter === 'in_transit' 
                            ? 'No overseas shipments currently in transit.' 
                            : 'No restock orders found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map(order => {
                        const dateStr = order.createdAt?.seconds
                          ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                          : 'Recent';

                        const isInTransit = order.status === 'in_transit';
                        const isReceived = order.status === 'received';

                        return (
                          <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* PO Number & Origin Hub */}
                            <td className="px-4 py-3 text-white">
                              <div className="font-mono font-bold text-white flex items-center gap-1.5">
                                <span>{order.originFlag || '🌐'}</span>
                                <span>{order.poNumber || order.id.slice(0, 8)}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {order.originHub || 'Overseas Trade Hub'} · {dateStr}
                              </div>
                            </td>

                            {/* Supplier Name */}
                            <td className="px-4 py-3 text-white font-medium">
                              <div className="font-semibold text-white">{order.supplierName || 'General Supplier'}</div>
                              {order.expectedLeadTime && (
                                <div className="text-[10px] text-slate-400">Est. Lead: {order.expectedLeadTime}</div>
                              )}
                            </td>

                            {/* Items / Units Count */}
                            <td className="px-4 py-3 text-center text-slate-300">
                              <span className="font-semibold text-white">
                                {order.totalUnits || 0} units
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {order.totalItemsCount || (order.items?.length || 0)} products
                              </div>
                            </td>

                            {/* Total Outflow */}
                            <td className="px-4 py-3 text-right">
                              <span className="text-emerald-400 font-bold font-mono">
                                {format(order.totalCost || 0)}
                              </span>
                              {order.freightCost > 0 && (
                                <div className="text-[10px] text-slate-400">
                                  incl. {format(order.freightCost)} freight
                                </div>
                              )}
                            </td>

                            {/* Payment Method & Slip */}
                            <td className="px-4 py-3 text-center">
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                                  {order.paymentSource === 'cash_drawer' ? '💵 Cash Drawer' :
                                   order.paymentSource === 'momo' ? '📱 MoMo' :
                                   order.paymentSource === 'bank_transfer' ? '🏦 Bank Wire' : '⏳ Credit / COD'}
                                </span>
                                {order.receiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => setViewReceiptModal(order)}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                                  >
                                    <Camera className="w-3 h-3" /> View Slip
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Status Badge */}
                            <td className="px-4 py-3 text-center">
                              {isInTransit ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <Ship className="w-3 h-3 animate-pulse" />
                                  <span>In Transit</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Received</span>
                                </span>
                              )}
                            </td>

                            {/* Monrovia Receiving Action */}
                            <td className="px-4 py-3 text-right">
                              {isInTransit ? (
                                <button
                                  type="button"
                                  disabled={receivingOrderId === order.id}
                                  onClick={() => handleReceiveOrder(order)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                                  title="Confirm delivery to Monrovia store and increment storeroom inventory"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  <span>{receivingOrderId === order.id ? 'Receiving...' : 'Receive into Storeroom'}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  {order.receivedAt?.seconds 
                                    ? `Landed ${new Date(order.receivedAt.seconds * 1000).toLocaleDateString()}`
                                    : 'Landed in Storeroom'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Receipt Preview Lightbox Modal */}
      {viewReceiptModal && (
        <Modal
          isOpen={true}
          onClose={() => setViewReceiptModal(null)}
          title={`Proof of Payment: ${viewReceiptModal.poNumber || 'Restock Order'}`}
        >
          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400">Paid To:</span>{' '}
                <strong className="text-white">{viewReceiptModal.supplierName}</strong>
              </div>
              <div>
                <span className="text-slate-400">Amount:</span>{' '}
                <strong className="text-emerald-400 font-mono text-sm">
                  {format(viewReceiptModal.totalCost || 0)}
                </strong>
              </div>
            </div>

            {viewReceiptModal.receiptImage ? (
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center p-2">
                <img
                  src={viewReceiptModal.receiptImage}
                  alt="Receipt"
                  className="max-h-[60vh] w-auto max-w-full rounded object-contain shadow-lg"
                />
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">No receipt image attached to this order.</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewReceiptModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Supplier Create / Edit Modal */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => {
          setIsSupplierModalOpen(false);
          setSelectedSupplierForEdit(null);
        }}
        editSupplier={selectedSupplierForEdit}
      />

      {/* Restock Order Generator Modal */}
      <RestockOrderModal
        isOpen={isRestockModalOpen}
        onClose={() => {
          setIsRestockModalOpen(false);
          setSelectedSupplierForRestock(null);
          setPrefilledRestockItems([]);
        }}
        supplier={selectedSupplierForRestock}
        products={products}
        suppliers={suppliers}
        prefilledItems={prefilledRestockItems}
      />
    </div>
  );
}
