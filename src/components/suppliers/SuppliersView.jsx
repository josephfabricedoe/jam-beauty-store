import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  addDoc 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import SupplierModal from './SupplierModal';
import RestockOrderModal from './RestockOrderModal';
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
  FileSpreadsheet,
  Boxes,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ClipboardList
} from 'lucide-react';

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

    return {
      activeCount: activeSuppliersList.length,
      linkedCount: suppliersWithLinkedItemsCount,
      avgLeadTime,
      deactivatedCount: deactivatedSuppliersList.length,
      totalCount: suppliers.length,
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
      return totalStock <= (p.reorderTrigger || 10);
    });
  }, [products]);

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

                      return (
                        <tr key={supplier.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Supplier Name & Code */}
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="font-semibold text-white">{supplier.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{supplier.code || '—'}</div>
                            {supplier.address && (
                              <div className="text-[10px] text-slate-500 truncate max-w-xs">{supplier.address}</div>
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
                              <span className="text-slate-600">—</span>
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
                            {supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : '—'}
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

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Create Restock Order for this supplier */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSupplierForRestock(supplier);
                                  setPrefilledRestockItems([]);
                                  setIsRestockModalOpen(true);
                                }}
                                title="Order Restock from Supplier"
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-white rounded-lg transition-colors"
                              >
                                <Boxes className="w-3.5 h-3.5" />
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
                Automated Restock Procedures
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Items below reorder minimum triggers across showroom and storeroom. Generate replenishment orders directly.
              </p>
            </div>

            <button
              type="button"
              disabled={lowStockProducts.length === 0}
              onClick={() => {
                setSelectedSupplierForRestock(null);
                setPrefilledRestockItems(lowStockProducts);
                setIsRestockModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors"
            >
              <Boxes className="w-4 h-4" />
              Reorder All Low Stock ({lowStockProducts.length})
            </button>
          </div>

          {/* Low Stock Items Grid/Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-3 py-3 text-center">Showroom</th>
                    <th className="px-3 py-3 text-center">Storeroom</th>
                    <th className="px-3 py-3 text-center">Total Stock</th>
                    <th className="px-3 py-3 text-center">Reorder Trigger</th>
                    <th className="px-4 py-3 text-right">Cost Price</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {lowStockProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-emerald-400">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                        <p className="font-semibold">All inventory items are well-stocked!</p>
                        <p className="text-xs text-slate-500 mt-1">No products currently sit below their reorder triggers.</p>
                      </td>
                    </tr>
                  ) : (
                    lowStockProducts.map(p => {
                      const totalStock = (p.showroomQty || 0) + (p.storeroomQty || 0);
                      const isZero = totalStock === 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="font-semibold text-white">{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.barcode || p.id}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {p.category || 'General'}
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
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
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
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSupplierForRestock(null);
                                setPrefilledRestockItems([p]);
                                setIsRestockModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                              Restock Item
                            </button>
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

      {/* VIEW 3: PURCHASE ORDERS LOG */}
      {viewTab === 'orders' && (
        <div className="space-y-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <h2 className="text-base font-bold text-white">Purchase & Restock Orders History</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Record of all placed restock purchase orders and stock receipts into storeroom.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">PO Number</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 text-center">Items / Units</th>
                    <th className="px-4 py-3 text-right">Total Est. Cost</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {restockOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No purchase restock orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    restockOrders.map(order => {
                      const dateStr = order.createdAt?.seconds
                        ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                        : 'Recent';

                      const isReceived = order.status === 'received';

                      return (
                        <tr key={order.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-white font-mono font-bold">
                            {order.poNumber || order.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-white font-medium">
                            {order.supplierName || 'General Supplier'}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-300">
                            {order.totalItemsCount || (order.items?.length || 0)} items ({order.totalUnits || 0} pcs)
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                            {format(order.totalCost || 0)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isReceived
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {order.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {dateStr}
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
        prefilledItems={prefilledRestockItems}
      />
    </div>
  );
}
