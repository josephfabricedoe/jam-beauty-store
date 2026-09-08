import React, { useMemo } from 'react';
import { useCurrency } from '../../hooks/useCurrency';

export default function TopProducts({ sales }) {
  const { format } = useCurrency();
  const products = useMemo(() => {
    const map = {};
    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.productId || item.name || 'Unknown';
        if (!map[key]) map[key] = { name: item.name || key, qty: 0, revenue: 0 };
        map[key].qty += item.quantity || 0;
        map[key].revenue += item.total || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [sales]);

  const max = products[0]?.revenue || 1;
  if (!products.length) return <p className="text-slate-500 text-sm text-center py-6">No product data yet.</p>;

  return (
    <div className="space-y-2.5">
      {products.map((p, i) => (
        <div key={p.name} className="flex items-center gap-3">
          <span className="text-xs text-slate-600 w-4 text-right flex-shrink-0">{i+1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-white truncate">{p.name}</span>
              <span className="text-sm font-semibold text-rose-300 ml-2 flex-shrink-0">{format(p.revenue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-rose-500 to-amber-400 rounded-full"
                  style={{ width: `${(p.revenue / max) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-500 flex-shrink-0">{p.qty} sold</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
