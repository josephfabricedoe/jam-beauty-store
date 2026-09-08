import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((r) => r.unregister());
        });
      }
    } catch (e) {
      console.warn('Cache clear error:', e);
    }
    window.location.hash = '';
    window.location.reload(true);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 max-w-md w-full rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#efaa9b]/20 border border-[#efaa9b]/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✨</span>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">JAM Beauty Store</h2>
            <p className="text-slate-400 text-sm mb-4">
              The application encountered a display refresh issue or an older browser cache was detected.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 mb-5 text-left">
                <p className="text-xs font-mono text-rose-300 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-[#efaa9b] hover:bg-[#e89887] text-[#45150b] font-bold text-sm rounded-xl transition-colors shadow-lg shadow-[#efaa9b]/20"
              >
                Clear Cache & Refresh App
              </button>
              <button
                onClick={() => {
                  window.location.hash = '#catalog';
                  window.location.reload();
                }}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Go to Public Customer Catalog
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
