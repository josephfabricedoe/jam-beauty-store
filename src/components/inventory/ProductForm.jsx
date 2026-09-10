import React, { useState, useEffect, useRef } from 'react';
import Modal from '../shared/Modal';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Save, Trash2, AlertCircle, Barcode, Camera, Image as ImageIcon, X, Building2 } from 'lucide-react';
import BarcodeScannerModal from '../shared/BarcodeScannerModal';

const CATEGORIES = ['Perfume', 'Cosmetics', 'Skincare', 'Haircare', 'Accessories', 'Body Care', 'Other'];

export default function ProductForm({ isOpen, onClose, editProduct = null }) {
  const isEdit = !!editProduct;

  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Perfume');
  const [supplierId, setSupplierId] = useState('');
  const [suppliersList, setSuppliersList] = useState([]);
  const [retailPrice, setRetailPrice] = useState('');
  const [halfDozenPrice, setHalfDozenPrice] = useState('');
  const [dozenPrice, setDozenPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [showroomQty, setShowroomQty] = useState(0);
  const [storeroomQty, setStoreroomQty] = useState(0);
  const [reorderTrigger, setReorderTrigger] = useState(10);
  const [imageUrl, setImageUrl] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Re-sync form state whenever editProduct or isOpen changes
  useEffect(() => {
    if (isOpen) {
      getDocs(collection(db, 'suppliers')).then(snap => {
        setSuppliersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(err => console.warn('Could not fetch suppliers:', err));

      if (editProduct) {
        setBarcode(editProduct.barcode || editProduct.id || '');
        setName(editProduct.name || '');
        setCategory(editProduct.category || 'Perfume');
        setSupplierId(editProduct.supplierId || '');
        setRetailPrice(editProduct.retailPrice != null ? String(editProduct.retailPrice) : '');
        setHalfDozenPrice(editProduct.halfDozenPrice != null ? String(editProduct.halfDozenPrice) : '');
        setDozenPrice(editProduct.dozenPrice != null ? String(editProduct.dozenPrice) : '');
        setCostPrice(editProduct.costPrice != null ? String(editProduct.costPrice) : '');
        setShowroomQty(editProduct.showroomQty != null ? editProduct.showroomQty : 0);
        setStoreroomQty(editProduct.storeroomQty != null ? editProduct.storeroomQty : 0);
        setReorderTrigger(editProduct.reorderTrigger != null ? editProduct.reorderTrigger : 10);
        setImageUrl(editProduct.imageUrl || '');
      } else {
        setBarcode('');
        setName('');
        setCategory('Perfume');
        setSupplierId('');
        setRetailPrice('');
        setHalfDozenPrice('');
        setDozenPrice('');
        setCostPrice('');
        setShowroomQty(0);
        setStoreroomQty(0);
        setReorderTrigger(10);
        setImageUrl('');
      }
      setError('');
      setConfirmDelete(false);
    }
  }, [isOpen, editProduct]);

  // Client-side HTML5 canvas image compressor to max 320x320
  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setImageUrl(compressedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanBarcode = barcode.trim();
    const cleanName = name.trim();

    if (!cleanBarcode) {
      setError('Barcode / SKU is mandatory. Please enter a valid barcode.');
      return;
    }
    if (!cleanName) {
      setError('Product Name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const selectedSupplier = suppliersList.find(s => s.id === supplierId);
      const payload = {
        barcode: cleanBarcode,
        name: cleanName,
        category,
        supplierId: supplierId || null,
        supplierName: selectedSupplier?.name || null,
        retailPrice: parseFloat(retailPrice) || 0,
        halfDozenPrice: parseFloat(halfDozenPrice) || 0,
        dozenPrice: parseFloat(dozenPrice) || 0,
        costPrice: parseFloat(costPrice) || 0,
        showroomQty: parseInt(showroomQty, 10) || 0,
        storeroomQty: parseInt(storeroomQty, 10) || 0,
        reorderTrigger: parseInt(reorderTrigger, 10) || 10,
        imageUrl: imageUrl || '',
        isTester: editProduct?.isTester || false,
        isDamaged: editProduct?.isDamaged || false,
        updatedAt: serverTimestamp(),
      };

      // If editing and barcode changed, remove old document to prevent ghost entries
      if (isEdit && editProduct.id && editProduct.id !== cleanBarcode) {
        await deleteDoc(doc(db, 'products', editProduct.id));
      }

      if (!isEdit) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(doc(db, 'products', cleanBarcode), payload, { merge: true });
      onClose();
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      const docId = editProduct.id || barcode;
      await deleteDoc(doc(db, 'products', docId));
      onClose();
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Product — ${editProduct?.name || barcode}` : 'Add New Product'}
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                confirmDelete
                  ? 'bg-red-500 text-white font-medium'
                  : 'bg-red-900/20 text-red-400 hover:bg-red-900/40'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'Confirm Delete?' : 'Delete'}
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              form="product-form"
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="text-sm text-red-400 flex items-center gap-2 bg-red-900/20 border border-red-700/40 rounded-xl px-3.5 py-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5 text-[#efaa9b]" />
              Barcode / SKU <span className="text-[#efaa9b] font-bold">* (Mandatory)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                required
                placeholder="e.g. 6001234567890"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b] focus:ring-1 focus:ring-[#efaa9b] transition-colors"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                title="Scan barcode with camera"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-lg font-bold text-xs transition-colors flex-shrink-0"
              >
                <Camera className="w-4 h-4" />
                <span>Scan</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Type or click Scan to capture from product barcode.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-rose-400" />
              Primary Supplier
            </label>
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
            >
              <option value="">(None / General Supplier)</option>
              {suppliersList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code || 'SUP'})</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Product Name <span className="text-rose-400 font-bold">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Tres Semme - Flawless Curls Green"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 transition-colors"
            />
          </div>

          {/* Product Photo section */}
          <div className="sm:col-span-2 bg-slate-700/40 border border-slate-600/70 rounded-xl p-3">
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#efaa9b]" />
                Product Photo (Optional — Helps cashier recognize item)
              </span>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Remove Photo
                </button>
              )}
            </label>

            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-[#efaa9b] flex-shrink-0 bg-black/40">
                  <img src={imageUrl} alt="Product preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg border border-dashed border-slate-500 flex items-center justify-center flex-shrink-0 bg-slate-800 text-slate-500">
                  <ImageIcon className="w-6 h-6 opacity-40" />
                </div>
              )}

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* File upload from gallery/desktop */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#efaa9b]" />
                    <span>Upload Photo</span>
                  </button>

                  {/* Direct Camera Capture */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take Photo</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="hidden"
                />

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageFile}
                  className="hidden"
                />

                <p className="text-[11px] text-slate-400">
                  Snap a quick photo with your phone or select an image. Photos are automatically compressed for high performance.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-2.5">
            Pricing (USD)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Retail Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={retailPrice}
                onChange={e => setRetailPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">6x Half Dozen ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={halfDozenPrice}
                onChange={e => setHalfDozenPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">12x Dozen ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={dozenPrice}
                onChange={e => setDozenPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs font-semibold text-rose-300 uppercase tracking-wider mb-2.5">
            Stock Quantities
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Showroom Qty</label>
              <input
                type="number"
                min="0"
                value={showroomQty}
                onChange={e => setShowroomQty(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Storeroom Qty</label>
              <input
                type="number"
                min="0"
                value={storeroomQty}
                onChange={e => setStoreroomQty(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={reorderTrigger}
                onChange={e => setReorderTrigger(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Barcode scanner modal for inventory input */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(scanned) => {
          setBarcode(scanned);
          setScannerOpen(false);
        }}
        title="Scan Product Barcode"
      />
    </Modal>
  );
}
