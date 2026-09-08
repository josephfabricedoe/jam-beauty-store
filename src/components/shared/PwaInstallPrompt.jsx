import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode (installed)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isApple);

    // Listen for beforeinstallprompt (Android Chrome, Edge, etc.)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        alert('To install on iPhone:\n1. Tap the Share button (square with arrow up at bottom of Safari)\n2. Scroll down and tap "Add to Home Screen"');
      } else {
        alert('To install:\n1. Tap Chrome menu (3 dots at top right)\n2. Tap "Install app" or "Add to Home screen"');
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 border-b border-rose-500/30 px-4 py-2 flex items-center justify-between text-xs animate-fade-in z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-rose-500 flex items-center justify-center flex-shrink-0 shadow-md">
          <Smartphone className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">Install JAM Beauty Store on this device</p>
          <p className="text-slate-400 text-[11px] truncate">
            Run fullscreen with fast camera access, flashlight & offline mode.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-lg font-medium transition-colors shadow-md shadow-rose-500/20"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="p-1 rounded text-slate-400 hover:text-white"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
