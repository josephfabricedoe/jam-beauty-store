import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Sparkles, MessageCircle, Send, Users, Tag, AlertCircle, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';

const CAMPAIGN_CATEGORIES = [
  { id: 'bestsellers', label: '🔥 Top 20 Bestsellers', path: '?filter=bestsellers' },
  { id: 'Perfume', label: '🌸 Perfumes & Scents', path: '?category=Perfume' },
  { id: 'Skincare', label: '✨ Skincare & Serums', path: '?category=Skincare' },
  { id: 'Body Care', label: '🧴 Body Care & Lotions', path: '?category=Body+Care' },
  { id: 'Hair', label: '💇‍♀️ Salon Haircare', path: '?category=Hair' },
  { id: 'Wholesale Sets', label: '🎁 Wholesale Packages', path: '?category=Wholesale+Sets' },
  { id: 'all', label: '🛍️ Entire Live Catalog', path: '' },
];

const CAMPAIGN_TEMPLATES = [
  {
    title: '🔥 Check Our Top 20 Bestsellers',
    category: 'bestsellers',
    offer: 'Bestsellers Drop',
    intro: `Hello {name}! 🌸\nExciting news from *JAM Beauty Store*! Here are our hottest best-selling beauty favorites today:`,
  },
  {
    title: '✨ New Arrivals & Restocked Glow',
    category: 'all',
    offer: 'New Collection',
    intro: `Hello {name}! ✨\nJust arrived at *JAM Beauty Store*! Fresh batch of authentic luxury fragrances and skincare essentials:`,
  },
  {
    title: '🌸 Luxury Perfume Spotlight',
    category: 'Perfume',
    offer: 'Fragrance Special',
    intro: `Hello {name}! 👑\nTurn heads everywhere you go! Discover our top luxury perfumes and Arabian scents at *JAM Beauty Store*:`,
  },
  {
    title: '🔥 Weekend Flash Sale',
    category: 'bestsellers',
    offer: '15% Off Flash Sale',
    intro: `Hello {name}! 🔥\n*WEEKEND FLASH SALE* at JAM Beauty Store! Grab our top-rated favorites at exclusive weekend rates:`,
  },
  {
    title: '💌 We Miss You / VIP Comeback',
    category: 'bestsellers',
    offer: 'Comeback Voucher',
    intro: `Dear {name}, 💕\nWe haven't seen you recently at *JAM Beauty Store* and we truly miss you! Here is what is trending right now:`,
  },
];

export default function CampaignModal({ 
  isOpen, 
  onClose, 
  onLaunchQueue = null, 
  customers = [],
  products = []
}) {
  const [title, setTitle] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('bestsellers');
  const [offerType, setOfferType] = useState('Bestsellers Drop');
  const [targetSegment, setTargetSegment] = useState('all');
  const [messageBody, setMessageBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const baseUrl = 'https://jambeautystore.com';

  // Helper to compose visual product copy
  const generateVisualCopy = (catId, introText) => {
    const selectedCat = CAMPAIGN_CATEGORIES.find(c => c.id === catId) || CAMPAIGN_CATEGORIES[0];
    const targetUrl = selectedCat.path ? `${baseUrl}/${selectedCat.path}` : baseUrl;

    // Filter products for category
    let matching = products.filter(p => {
      if (catId === 'all' || catId === 'bestsellers') return true;
      const c = (p.category || '').toLowerCase();
      return c.includes(catId.toLowerCase());
    });

    // Prioritize items with in-stock showroom quantity
    matching = [...matching].sort((a, b) => (b.showroomQty || 0) - (a.showroomQty || 0));

    const topItems = matching.slice(0, 3);
    let itemsBlock = '';
    if (topItems.length > 0) {
      const numberEmojis = ['1️⃣', '2️⃣', '3️⃣'];
      itemsBlock = '\n\n' + topItems.map((p, i) => {
        const price = Number(p.retailPrice || 0).toFixed(2);
        return `${numberEmojis[i] || '✨'} *${p.name}* — $${price} USD`;
      }).join('\n') + '\n';
    }

    const cta = catId === 'bestsellers' 
      ? `👉 *Tap here to view all 20 bestsellers & shop live:*\n${targetUrl}`
      : `👉 *Tap here to view all ${selectedCat.label.replace(/[^a-zA-Z &]/g, '').trim()} & shop live:*\n${targetUrl}`;

    return `${introText}${itemsBlock}\n${cta}\n\nFast delivery across Monrovia! Reply to order or ask any question. 🛍️`;
  };

  useEffect(() => {
    if (isOpen) {
      const defaultTpl = CAMPAIGN_TEMPLATES[0];
      setTitle(defaultTpl.title);
      setSelectedCatId(defaultTpl.category);
      setOfferType(defaultTpl.offer);
      setMessageBody(generateVisualCopy(defaultTpl.category, defaultTpl.intro));
      setTargetSegment('all');
      setError('');
      setCopied(false);
    }
  }, [isOpen, products]);

  const handleSelectTemplate = (tpl) => {
    setTitle(tpl.title);
    setSelectedCatId(tpl.category);
    setOfferType(tpl.offer);
    setMessageBody(generateVisualCopy(tpl.category, tpl.intro));
  };

  // Target audience count
  const targetedAudience = customers.filter(c => {
    const hasPhone = Boolean(c.phone && c.phone.trim().length >= 6);
    if (!hasPhone) return false;

    if (targetSegment === 'vip') {
      return (c.customerType || '').toLowerCase().includes('vip');
    }
    if (targetSegment === 'salon') {
      return (c.customerType || '').toLowerCase().includes('salon') || (c.customerType || '').toLowerCase().includes('wholesale');
    }
    if (targetSegment === 'lapsed') {
      return Boolean(c.isLapsed);
    }
    return true;
  });

  const previewFormatted = messageBody
    .replace('{name}', 'Valued Customer')
    .replace('{store_url}', baseUrl);

  const handleSave = async (launchBroadcast = false) => {
    if (!title.trim() || !messageBody.trim()) {
      setError('Please provide a campaign title and message body.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const campaignData = {
        title: title.trim(),
        offerType: offerType.trim(),
        targetSegment,
        targetCategory: selectedCatId,
        messageBody: messageBody.trim(),
        audienceCount: targetedAudience.length,
        createdAt: serverTimestamp(),
        lastSentAt: launchBroadcast ? serverTimestamp() : null,
      };

      const docRef = await addDoc(collection(db, 'marketingCampaigns'), campaignData);

      if (launchBroadcast && onLaunchQueue) {
        onLaunchQueue({
          id: docRef.id,
          ...campaignData,
          audience: targetedAudience,
        });
      }

      onClose();
    } catch (err) {
      console.error('Error saving campaign:', err);
      setError(err.message || 'Failed to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(previewFormatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create WhatsApp Marketing Campaign"
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Template Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            Choose High-Converting Template:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {CAMPAIGN_TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`p-2 rounded-xl text-left text-xs transition-all border ${
                  title === tpl.title
                    ? 'bg-rose-500/20 border-rose-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="truncate">{tpl.title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Campaign Target Category & Deep Link */}
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-rose-400" />
              Campaign Product Category & Deep Link:
            </label>
            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Links to Frontstore
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {CAMPAIGN_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCatId(cat.id);
                  const currentIntro = messageBody.split('\n\n')[0] || `Hello {name}! 🌸\nCheck out our featured ${cat.label.replace(/[^a-zA-Z &]/g, '').trim()} today at *JAM Beauty Store*:`;
                  setMessageBody(generateVisualCopy(cat.id, currentIntro));
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs text-left font-medium transition-all border ${
                  selectedCatId === cat.id
                    ? 'bg-rose-500 text-white border-rose-500 font-bold shadow-sm'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
              >
                <div className="truncate">{cat.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title & Segment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Campaign Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekend Flash Sale"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Target Audience
            </label>
            <div className="relative">
              <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={targetSegment}
                onChange={(e) => setTargetSegment(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                <option value="all">All Reachable Customers ({customers.filter(c => c.phone).length})</option>
                <option value="vip">VIP Clients Only</option>
                <option value="salon">Salon & Wholesale Partners</option>
                <option value="lapsed">Lapsed Customers (&gt;90 days inactive)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Message Editor */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">
              WhatsApp Broadcast Copy
            </label>
            <span className="text-[11px] text-slate-400 font-mono">
              Tags: <code className="text-rose-400 font-bold">{'{name}'}</code>, <code className="text-[#efaa9b] font-bold">{'{store_url}'}</code>
            </span>
          </div>
          <textarea
            rows={5}
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500 font-sans leading-relaxed"
          />
        </div>

        {/* Message Preview */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Message Preview
            </span>
            <button
              type="button"
              onClick={handleCopyPreview}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="bg-[#0b141a] text-slate-200 p-3 rounded-lg text-xs whitespace-pre-wrap font-sans border border-slate-800/80 leading-relaxed shadow-inner">
            {previewFormatted}
          </div>
        </div>

        {/* Audience Reach Note */}
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs">
          <span className="text-slate-300">
            Reach count for this segment:
          </span>
          <span className="font-extrabold text-rose-300">
            {targetedAudience.length} customer contacts ready
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving || targetedAudience.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Launch WhatsApp Broadcast'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
