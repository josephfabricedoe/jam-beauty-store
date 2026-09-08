import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  Cash: '#10b981',
  MoMo: '#3b82f6',
  Card: '#fbbf24',
  Transfer: '#a78bfa',
  Other: '#64748b'
};

export default function PaymentPieChart({ sales = [], deliveries = [] }) {
  const data = useMemo(() => {
    const map = {};

    // Store POS payment methods
    sales.forEach(s => {
      const m = s.paymentMethod || 'Cash';
      map[m] = (map[m] || 0) + (s.total || 0);
    });

    // Deliveries payment methods
    deliveries.forEach(d => {
      if (d.paymentStatus === 'Paid' || d.cashConfirmed) {
        const m = d.paymentStatus === 'MoMo' ? 'MoMo' : 'Cash';
        map[m] = (map[m] || 0) + (d.charge || 0);
      }
    });

    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [sales, deliveries]);

  if (!data.length) {
    return <p className="text-slate-500 text-sm text-center py-8">No payment records yet.</p>;
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map(e => (
            <Cell key={e.name} fill={COLORS[e.name] || COLORS.Other} />
          ))}
        </Pie>
        <Tooltip
          formatter={v => [`$${Number(v).toFixed(2)} (${total > 0 ? ((Number(v)/total)*100).toFixed(0) : 0}%)`, 'Amount']}
          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }}
        />
        <Legend
          formatter={(v, e) => (
            <span style={{ color: '#cbd5e1', fontSize: 11 }}>
              {v}: ${Number(e.payload.value).toFixed(2)} ({total > 0 ? ((Number(e.payload.value)/total)*100).toFixed(0) : 0}%)
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
