import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import Shell from './components/layout/Shell';
import CustomerCatalog from './components/public/CustomerCatalog';

function getInitialView() {
  const host = window.location.hostname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const path = window.location.pathname.toLowerCase();

  // Explicit hash or path commands
  if (hash === '#catalog' || path.startsWith('/catalog')) return 'catalog';
  if (hash === '#staff' || hash === '#admin' || hash === '#pos' || path.startsWith('/login') || path.startsWith('/app')) return 'staff';

  // Subdomain check: app.jambeautystore.com or pos.jambeautystore.com opens Staff portal
  if (host.startsWith('app.') || host.startsWith('pos.') || host.startsWith('admin.')) {
    return 'staff';
  }

  // Main domain (jambeautystore.com, www.jambeautystore.com, localhost) defaults to Customer Catalog!
  return 'catalog';
}

export default function App() {
  const { currentUser, loading } = useAuth();
  const [view, setView] = useState(getInitialView);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#catalog') setView('catalog');
      else if (hash === '#staff' || hash === '#login' || hash === '#app') setView('staff');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#efaa9b] border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Loading JAM Beauty Store...</p>
        </div>
      </div>
    );
  }

  // Public Customer Catalog View (Default for jambeautystore.com)
  if (view === 'catalog') {
    return (
      <CustomerCatalog
        onGoToLogin={() => {
          window.location.hash = '#staff';
          setView('staff');
        }}
      />
    );
  }

  // Staff & Admin Portal View (Default for app.jambeautystore.com or #staff)
  return currentUser ? (
    <Shell
      onGoToCatalog={() => {
        window.location.hash = '#catalog';
        setView('catalog');
      }}
    />
  ) : (
    <LoginPage
      onOpenCatalog={() => {
        window.location.hash = '#catalog';
        setView('catalog');
      }}
    />
  );
}
