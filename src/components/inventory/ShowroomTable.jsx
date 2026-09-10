import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useCurrency } from '../../hooks/useCurrency';
import ProductForm from './ProductForm';
import BarcodeLabelModal from './BarcodeLabelModal';
import {
  AlertTriangle, FlaskConical, Edit2, PlusCircle, Download,
  Search, ChevronDown, ChevronRight, Image as ImageIcon, Package, Filter, X, Tag, Boxes
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportCsv';

const ALL_CATEGORIES = ['All', 'Perfume', 'Cosmetics', 'Skincare', 'Haircare', 'Accessories', 'Body Care', 'Other'];

export default function ShowroomTable({ onRestockClick }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeTargetProduct, setBarcodeTargetProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const { format } = useCurrency();

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const toggleTester = (product) =>
    updateDoc(doc(db, 'products', product.id), { isTester: !product.isTester });

  const toggleCollapse = (cat) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Filtered products by search and category
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || (p.category || 'Other') === selectedCategory;
    if (!matchesCat) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const name = (p.name || '').toLowerCase();
    const barcode = (p.barcode || p.id || '').toString().toLowerCase();
    const cat = (p.category || '').toLowerCase();

    return name.includes(q) || barcode.includes(q) || cat.includes(q);
  });

  // Group filtered products by Category
  const groupedByCategory = filteredProducts.reduce((acc, p) => {
    const cat = p.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const categoryKeys = Object.keys(groupedByCategory).sort();

  const handleExportStockCSV = () => {
    const data = products.map(p => {
      const showQty = p.showroomQty || 0;
      const storeQty = p.storeroomQty || 0;
      const totalQty = showQty + storeQty;
      const retailPrice = p.retailPrice || 0;
      const costPrice = p.costPrice || 0;

      return {
        barcode: p.barcode || p.id || '',
        name: p.name || '',
        category: p.category || '',
        retailPrice: retailPrice.toFixed(2),
        halfDozenPrice: (p.halfDozenPrice || 0).toFixed(2),
        dozenPrice: (p.dozenPrice || 0).toFixed(2),
        costPrice: costPrice.toFixed(2),
        showroomQty: showQty,
        storeroomQty: storeQty,
        totalStock: totalQty,
        totalRetailValue: (totalQty * retailPrice).toFixed(2),
        totalCostValue: (totalQty * costPrice).toFixed(2),
      };
    });

    const headers = {
      barcode: 'Barcode / SKU',
      name: 'Product Name',
      category: 'Category',
      retailPrice: 'Retail Price ($)',
      halfDozenPrice: 'Half Dozen 6x Price ($)',
      dozenPrice: 'Dozen 12x Price ($)',
      costPrice: 'Cost Price ($)',
      showroomQty: 'Showroom Stock',
      storeroomQty: 'Storeroom Stock',
      totalStock: 'Total Units in Stock',
      totalRetailValue: 'Total Inventory Retail Value ($)',
      totalCostValue: 'Total Inventory Cost Value ($)',
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`jam_beauty_inventory_stock_${todayStr}.csv`, data, headers);
  };

  if (loading) return <div className="text-slate-500 text-sm p-4">Loading products...</div>;

  return (
    <div className="space-y-3">
      {/* Top Search & Actions Bar */}
      <div className="p-3 bg-slate-800/60 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Bar for manual adjustments */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search product name or barcode to edit..."
            className="w-full bg-slate-700/80 border border-slate-600 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#efaa9b]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBarcodeTargetProduct(products[0] || null);
              setBarcodeModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-[#efaa9b]/60 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Tag className="w-3.5 h-3.5 text-[#efaa9b]" />
            <span>Print Barcodes</span>
          </button>

          <button
            type="button"
            onClick={handleExportStockCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-[#efaa9b]/60 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#efaa9b]" />
            <span>Export Stock (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="px-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        {ALL_CATEGORIES.map(cat => {
          const count = cat === 'All' ? products.length : products.filter(p => (p.category || 'Other') === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedCategory === cat
                  ? 'bg-[#efaa9b] text-[#45150b] shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === cat ? 'bg-[#45150b]/20 text-[#45150b]' : 'bg-slate-700 text-slate-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Categorized Products List */}
      <div className="px-3 pb-3 space-y-3">
        {categoryKeys.length > 0 ? (
          categoryKeys.map(cat => {
            const catItems = groupedByCategory[cat] || [];
            const isCollapsed = !!collapsedCategories[cat];
            const totalUnits = catItems.reduce((s, i) => s + (i.showroomQty || 0), 0);
            const totalVal = catItems.reduce((s, i) => s + ((i.showroomQty || 0) * (i.retailPrice || 0)), 0);

            return (
              <div key={cat} className="border border-slate-700/80 rounded-2xl overflow-hidden bg-slate-800/40">
                {/* Category Header Accordion */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/90 hover:bg-slate-800 border-b border-slate-700 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-[#efaa9b]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#efaa9b]" />
                    )}
                    <h3 className="font-bold text-white text-sm">{cat}</h3>
                    <span className="text-xs text-slate-400 font-normal">
                      ({catItems.length} product{catItems.length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Stock: <strong className="text-white">{totalUnits} units</strong></span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">Valuation: <strong className="text-emerald-400">{format(totalVal)}</strong></span>
                  </div>
                </button>

                {/* Products Table for this category */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-700/80">
                          <th className="text-left px-3 py-2 w-12">Photo</th>
                          <th className="text-left px-3 py-2">Barcode</th>
                          <th className="text-left px-3 py-2">Product Name</th>
                          <th className="text-right px-3 py-2">Stock</th>
                          <th className="text-right px-3 py-2">Retail Price</th>
                          <th className="text-right px-3 py-2 hidden md:table-cell">6x Price</th>
                          <th className="text-right px-3 py-2 hidden md:table-cell">12x Price</th>
                          <th className="text-center px-3 py-2">Manual Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map(p => (
                          <tr
                            key={p.id || p.barcode}
                            className={`border-b border-slate-800/80 hover:bg-slate-800/60 transition-colors ${
                              p.isDamaged ? 'opacity-50' : ''
                            }`}
                          >
                            {/* Photo Thumbnail */}
                            <td className="px-3 py-2">
                              {p.imageUrl ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-600 bg-black/40 flex-shrink-0">
                                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-500">
                                  <ImageIcon className="w-4 h-4 opacity-40" />
                                </div>
                              )}
                            </td>

                            {/* Barcode */}
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                              {p.barcode || p.id}
                            </td>

                            {/* Product Name */}
                            <td className="px-3 py-2">
                              <div className="font-semibold text-white text-xs">{p.name}</div>
                              {p.supplierName && (
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                  <span className="text-slate-500">Supplier:</span>
                                  <span className="text-slate-300 font-medium">{p.supplierName}</span>
                                </div>
                              )}
                              {(p.isTester || p.isDamaged) && (
                                <div className="flex gap-1 mt-0.5">
                                  {p.isTester && <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.2 rounded">Tester</span>}
                                  {p.isDamaged && <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.2 rounded">Damaged</span>}
                                </div>
                              )}
                            </td>

                            {/* Showroom Stock */}
                            <td className="px-3 py-2 text-right">
                              <span className={`font-bold ${(p.showroomQty || 0) < 5 ? 'text-red-400' : 'text-white'}`}>
                                {p.showroomQty || 0}
                              </span>
                              {(p.showroomQty || 0) < 5 && <AlertTriangle className="w-3 h-3 text-red-400 inline ml-1" />}
                            </td>

                            {/* Retail Price */}
                            <td className="px-3 py-2 text-right text-rose-300 font-semibold font-mono">
                              {format(p.retailPrice)}
                            </td>

                            {/* 6x Price */}
                            <td className="px-3 py-2 text-right text-slate-400 font-mono hidden md:table-cell">
                              {format(p.halfDozenPrice)}
                            </td>

                            {/* 12x Price */}
                            <td className="px-3 py-2 text-right text-slate-400 font-mono hidden md:table-cell">
                              {format(p.dozenPrice)}
                            </td>

                            {/* Actions: Restock + Edit + Barcode + Tester */}
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1.5">
                                {onRestockClick && (
                                  <button
                                    type="button"
                                    onClick={() => onRestockClick(p)}
                                    title="1-Click Restock with Supplier (Owner / CEO)"
                                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    <Boxes className="w-3 h-3" />
                                    <span>Restock</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setEditProduct(p)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-[#efaa9b] hover:text-[#45150b] text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setBarcodeTargetProduct(p);
                                    setBarcodeModalOpen(true);
                                  }}
                                  title="Print Barcode Label Sticker"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#efaa9b] hover:bg-slate-700/60 transition-colors"
                                >
                                  <Tag className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleTester(p)}
                                  title="Toggle Tester Unit"
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    p.isTester ? 'bg-purple-900/50 text-purple-300' : 'text-slate-600 hover:text-purple-400'
                                  }`}
                                >
                                  <FlaskConical className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-700">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No products matching your search.</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing the search or category filter.</p>
          </div>
        )}
      </div>

      <ProductForm isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <ProductForm isOpen={!!editProduct} onClose={() => setEditProduct(null)} editProduct={editProduct} />
      <BarcodeLabelModal
        isOpen={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        initialProduct={barcodeTargetProduct}
        allProducts={products}
      />
    </div>
  );
}
