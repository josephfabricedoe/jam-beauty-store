import React from 'react';
import { useCurrency } from '../../hooks/useCurrency';
import { TrendingUp, TrendingDown, DollarSign, Percent, Wallet, CreditCard } from 'lucide-react';

function MetricCard({ label, value, subtext, icon: Icon, color = 'rose' }) {
  const colors = {
    green: 'from-emerald-500/15 to-emerald-600/5 border-emerald-500/30 text-emerald-300',
    red:   'from-rose-500/15 to-rose-600/5 border-rose-500/30 text-rose-300',
    amber: 'from-amber-500/15 to-amber-600/5 border-amber-500/30 text-amber-300',
    blue:  'from-blue-500/15 to-blue-600/5 border-blue-500/30 text-blue-300',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-4 flex flex-col justify-between`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
        <div className="p-2 rounded-xl bg-white/5 flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {subtext && (
        <p className="text-[11px] text-slate-500 mt-2 border-t border-white/5 pt-1.5 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default function SummaryMetrics({ sales = [], expenses = [], deliveries = [] }) {
  const { format } = useCurrency();

  // 1. Inflows
  const posSalesTotal = sales.reduce((s, sale) => s + (sale.total || 0), 0);
  const deliveryIncome = deliveries
    .filter(d => d.paymentStatus === 'Paid' || d.cashConfirmed)
    .reduce((s, d) => s + (d.charge || 0), 0);
  const grossRevenue = posSalesTotal + deliveryIncome;

  // 2. Outflows
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // 3. Financial Net Profit
  const netIncome = grossRevenue - totalExpenses;
  const netMargin = grossRevenue > 0 ? ((netIncome / grossRevenue) * 100).toFixed(1) : '0.0';

  // 4. Physical Drawer Cash Breakdown
  const cashSales = sales
    .filter(s => (s.paymentMethod || 'Cash').toLowerCase() === 'cash')
    .reduce((s, sale) => s + (sale.total || 0), 0);

  const cashDeliveries = deliveries
    .filter(d => (d.paymentStatus === 'Paid' || d.cashConfirmed) && (d.paymentStatus === 'COD' || d.paymentStatus === 'Paid'))
    .reduce((s, d) => s + (d.charge || 0), 0);

  const expectedDrawerCash = (cashSales + cashDeliveries) - totalExpenses;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Gross Revenue"
          value={format(grossRevenue)}
          subtext={`Store: ${format(posSalesTotal)} · Delivery: ${format(deliveryIncome)}`}
          icon={TrendingUp}
          color="green"
        />

        <MetricCard
          label="Operating Expenses"
          value={format(totalExpenses)}
          subtext={`${expenses.length} expense log(s)`}
          icon={TrendingDown}
          color="red"
        />

        <MetricCard
          label="Net Operating Profit"
          value={format(netIncome)}
          subtext={`Revenue minus operating expenses`}
          icon={DollarSign}
          color={netIncome >= 0 ? 'green' : 'red'}
        />

        <MetricCard
          label="Net Profit Margin"
          value={`${netMargin}%`}
          subtext={`Operating margin for period`}
          icon={Percent}
          color="amber"
        />
      </div>

      {/* Cash Drawer vs Electronic Inflows Quick Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl p-3 text-xs">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">Expected Physical Cash in Drawer:</span>
          </div>
          <span className="text-white font-bold text-sm">{format(expectedDrawerCash)}</span>
        </div>

        <div className="flex items-center justify-between px-2 border-t sm:border-t-0 sm:border-l border-slate-700/60 pt-2 sm:pt-0">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300 font-medium">Digital/Bank/MoMo Inflows:</span>
          </div>
          <span className="text-white font-bold text-sm">{format(grossRevenue - (cashSales + cashDeliveries))}</span>
        </div>
      </div>
    </div>
  );
}
