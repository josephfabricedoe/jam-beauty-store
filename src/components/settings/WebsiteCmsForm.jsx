import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Save, CheckCircle, Globe, MessageCircle, MapPin, Sparkles, ExternalLink, Phone, Clock, Truck } from 'lucide-react';

export default function WebsiteCmsForm({ settings }) {
  const [whatsappNumber, setWhatsappNumber] = useState('0778433270');
  const [storePhone, setStorePhone] = useState('0778433270');
  const [storeLocation, setStoreLocation] = useState('Monrovia, Liberia');
  const [heroLabel, setHeroLabel] = useState('NEW SEASON');
  const [heroTitle, setHeroTitle] = useState('Beauty essentials, delivered in Monrovia');
  const [heroSubtitle, setHeroSubtitle] = useState('Authentic skincare and fragrance, hand-picked for Liberian skin.');
  const [deliveryNote, setDeliveryNote] = useState('Same-Day Monrovia Rider Delivery');
  const [storeHours, setStoreHours] = useState('Mon - Sat: 8:30 AM - 6:30 PM');
  const [announcementBanner, setAnnouncementBanner] = useState('Authentic Skincare, Fragrance & Cosmetics delivered directly to your doorstep in Monrovia');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      if (settings.whatsappNumber !== undefined) setWhatsappNumber(settings.whatsappNumber);
      else if (settings.phone) setWhatsappNumber(settings.phone);
      
      if (settings.storePhone !== undefined) setStorePhone(settings.storePhone);
      else if (settings.phone) setStorePhone(settings.phone);

      if (settings.storeLocation !== undefined) setStoreLocation(settings.storeLocation);
      else if (settings.address) setStoreLocation(settings.address);

      if (settings.heroLabel !== undefined) setHeroLabel(settings.heroLabel);
      if (settings.heroTitle !== undefined) setHeroTitle(settings.heroTitle);
      if (settings.heroSubtitle !== undefined) setHeroSubtitle(settings.heroSubtitle);
      if (settings.deliveryNote !== undefined) setDeliveryNote(settings.deliveryNote);
      if (settings.storeHours !== undefined) setStoreHours(settings.storeHours);
      if (settings.announcementBanner !== undefined) setAnnouncementBanner(settings.announcementBanner);
    }
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'storeSettings', 'config'), {
        whatsappNumber,
        phone: storePhone || whatsappNumber,
        storePhone,
        address: storeLocation,
        storeLocation,
        heroLabel,
        heroTitle,
        heroSubtitle,
        deliveryNote,
        storeHours,
        announcementBanner,
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save website information: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#efaa9b]" />
            <span>Website & Online Catalog Content Manager</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Everything you edit here updates the live customer website (jambeautystore.com) in real-time.
          </p>
        </div>

        <a
          href="/#catalog"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[#efaa9b] rounded-xl text-xs font-semibold transition-colors"
        >
          <span>Preview Live Website</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* 1. Contact & WhatsApp */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-[#efaa9b] uppercase tracking-wider flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Business WhatsApp & Contact Info</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Business WhatsApp Number (Orders sent here)
            </label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={e => setWhatsappNumber(e.target.value)}
              placeholder="0778433270"
              required
              className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Customer bags & delivery details will be forwarded directly to this WhatsApp.
            </p>
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Store Hotline / Call Number
            </label>
            <input
              type="text"
              value={storePhone}
              onChange={e => setStorePhone(e.target.value)}
              placeholder="0778433270"
              className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Displayed in website footer for voice calls.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Physical Store Location & Pickup Address
            </label>
            <input
              type="text"
              value={storeLocation}
              onChange={e => setStoreLocation(e.target.value)}
              placeholder="e.g. Center Street, Monrovia, Liberia"
              required
              className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>
        </div>
      </div>

      {/* 2. Hero Banner & Messaging */}
      <div className="space-y-3 pt-3 border-t border-slate-700">
        <h4 className="text-xs font-bold text-[#efaa9b] uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Homepage Hero Section & Headline</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Small Announcement Tag
            </label>
            <input
              type="text"
              value={heroLabel}
              onChange={e => setHeroLabel(e.target.value)}
              placeholder="NEW SEASON"
              className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Delivery Badge Text
            </label>
            <input
              type="text"
              value={deliveryNote}
              onChange={e => setDeliveryNote(e.target.value)}
              placeholder="Same-Day Monrovia Rider Delivery"
              className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Main Headline
            </label>
            <input
              type="text"
              value={heroTitle}
              onChange={e => setHeroTitle(e.target.value)}
              placeholder="Beauty essentials, delivered in Monrovia"
              className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-slate-300 font-medium mb-1">
              Subtitle / Description
            </label>
            <textarea
              rows={2}
              value={heroSubtitle}
              onChange={e => setHeroSubtitle(e.target.value)}
              placeholder="Authentic skincare and fragrance, hand-picked for Liberian skin."
              className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
            />
          </div>
        </div>
      </div>

      {/* 3. Opening Hours */}
      <div className="space-y-3 pt-3 border-t border-slate-700">
        <h4 className="text-xs font-bold text-[#efaa9b] uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Opening Hours & Store Operations</span>
        </h4>

        <div>
          <label className="block text-xs text-slate-300 font-medium mb-1">
            Store Business Hours
          </label>
          <input
            type="text"
            value={storeHours}
            onChange={e => setStoreHours(e.target.value)}
            placeholder="Mon - Sat: 8:30 AM - 6:30 PM"
            className="w-full bg-slate-700/80 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#efaa9b]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-3 border-t border-slate-700">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#efaa9b] hover:bg-[#e89887] disabled:opacity-50 text-[#45150b] rounded-xl text-xs font-black transition-colors shadow-lg shadow-[#efaa9b]/25"
        >
          {saved ? <><CheckCircle className="w-4 h-4" /> Changes Published Live!</> : <><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save & Publish to Website'}</>}
        </button>
        {saved && <span className="text-emerald-400 text-xs font-semibold">Live website updated successfully.</span>}
      </div>
    </form>
  );
}
