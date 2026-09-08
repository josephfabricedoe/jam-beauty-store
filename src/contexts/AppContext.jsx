import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [activeModule, setActiveModule] = useState('pos');
  const [viewMode, setViewMode] = useState('staff'); // 'staff' | 'admin'
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(197);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [storeSettings, setStoreSettings] = useState({ storeName: 'JAM Beauty Store', address: '', phone: '' });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'storeSettings', 'config'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setExchangeRate(data.exchangeRate || 197);
          setStoreSettings(data);
        }
      },
      (err) => {
        console.warn('Store settings listener notice:', err.message || err);
      }
    );
    return unsub;
  }, []);

  const toggleCurrency = () => setCurrency(c => c === 'USD' ? 'LRD' : 'USD');
  const toggleSidebar = () => setIsSidebarOpen(o => !o);

  const updateExchangeRate = async (rate) => {
    await setDoc(doc(db, 'storeSettings', 'config'), { exchangeRate: rate }, { merge: true });
  };

  return (
    <AppContext.Provider value={{
      activeModule, setActiveModule,
      viewMode, setViewMode,
      currency, toggleCurrency,
      exchangeRate, updateExchangeRate,
      isSidebarOpen, toggleSidebar,
      storeSettings,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
