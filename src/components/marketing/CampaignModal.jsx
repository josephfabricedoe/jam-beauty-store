import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Sparkles, MessageCircle, Send, Users, Tag, AlertCircle, Copy, Check } from 'lucide-react';

const CAMPAIGN_TEMPLATES = [
  {
    title: '✨ New Arrivals Drop',
    offer: 'New Collection',
    body: `Hello {name}! 🌸\nExciting news from *JAM Beauty Store*! We just received new arrivals of your favorite luxury perfumes, cosmetics, and skincare.\n\n✨ Browse our live online store right now:\n{store_url}\n\nVisit us in-store or reply to order directly with fast Monrovia delivery! 🛍️`,
  },
  {
    title: '🔥 Weekend Flash Sale',
    offer: '15% Off Flash Sale',
    body: `Hello {name}! 🔥\n*WEEKEND FLASH SALE* at JAM Beauty Store!\nEnjoy exclusive discounts on selected perfumes and beauty essentials this weekend only.\n\nBrowse catalog & claim your items:\n{store_url}\n\nDon't miss out, limited stock available! 💃`,
  },
  {
    title: '👑 VIP Appreciation Special',
    offer: 'VIP Client Gift',
    body: `Dear {name}, 👑\nAs one of our cherished VIP clients, *JAM Beauty Store* is delighted to offer you an exclusive beauty gift with your next order.\n\nCheck out what is in store:\n{store_url}\n\nThank you for choosing us for your beauty care! 💖`,
  },
  {
    title: '💌 We Miss You / Come Back Gift',
    offer: 'Comeback Voucher',
    body: `Hello {name}! 💕\nWe haven't seen you at *JAM Beauty Store* recently and we truly miss you!\n\nWe would love to welcome you back with a special store treat. Explore our freshest stock here:\n{store_url}\n\nCan't wait to serve you again! ✨`,
  },
  {
    title: '📦 Bestseller Restock Alert',
    offer: 'Restocked Items',
    body: `Hello {name}! 📦\nGood news! Your favorite sold-out beauty favorites and top-selling fragrances are officially back in stock at *JAM Beauty Store*!\n\nView available quantities:\n{store_url}\n\nOrder now before items sell out again! 🏃‍♀️`,
  },
];

export default function CampaignModal({ 
  isOpen, 
  onClose, 
  onLaunchQueue = null, 
  customers = [] 
}) {
  const [title, setTitle] = useState('');
  const [offerType, setOfferType] = useState('New Collection');
  const [targetSegment, setTargetSegment] = useState('all');
  const [messageBody, setMessageBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const storeUrl = 'https://jambeautystore.com';

  useEffect(() => {
    if (isOpen) {
      const defaultTpl = CAMPAIGN_TEMPLATES[0];
      setTitle(defaultTpl.title);
      setOfferType(defaultTpl.offer);
      setMessageBody(defaultTpl.body);
      setTargetSegment('all');
      setError('');
      setCopied(false);
    }
  }, [isOpen]);

  const handleSelectTemplate = (tpl) => {
    setTitle(tpl.title);
    setOfferType(tpl.offer);
    setMessageBody(tpl.body);
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
    .replace('{store_url}', storeUrl);

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
