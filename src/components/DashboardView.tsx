/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  TrendingUp,
  PhoneCall,
  CheckCircle,
  XCircle,
  Clock,
  PhoneOff,
  Percent,
  BadgeCent,
  ListOrdered,
  Users
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Order, CallLog, RealtimeStats } from '../types';

interface DashboardProps {
  orders: Order[];
  calls: CallLog[];
  stats: RealtimeStats;
  onNavigateToCalling: () => void;
}

export default function DashboardView({ orders, calls, stats, onNavigateToCalling }: DashboardProps) {
  // Confirmation rate over different cities
  const cityDistribution = React.useMemo(() => {
    const cities: Record<string, { total: number; confirmed: number }> = {};
    orders.forEach((o) => {
      if (!o.city) return;
      const c = o.city.trim();
      if (!cities[c]) {
        cities[c] = { total: 0, confirmed: 0 };
      }
      cities[c].total += 1;
      if (o.status === 'Confirmed') {
        cities[c].confirmed += 1;
      }
    });

    return Object.entries(cities)
      .map(([name, val]) => ({
        name,
        total: val.total,
        confirmed: val.confirmed,
        rate: val.total > 0 ? Math.round((val.confirmed / val.total) * 100) : 0,
      }))
      .slice(0, 6);
  }, [orders]);

  // Daily confirmations & cancellations trend
  const dailyStats = React.useMemo(() => {
    const days: Record<string, { name: string; confirmed: number; cancelled: number }> = {};
    orders.forEach((o) => {
      const dateStr = new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (!days[dateStr]) {
        days[dateStr] = { name: dateStr, confirmed: 0, cancelled: 0 };
      }
      if (o.status === 'Confirmed') {
        days[dateStr].confirmed += 1;
      } else if (o.status === 'Cancelled') {
        days[dateStr].cancelled += 1;
      }
    });

    return Object.values(days).slice(-7);
  }, [orders]);

  // Product popularity list
  const productDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const shortName = o.productName.split('(')[0].trim().slice(0, 20);
      counts[shortName] = (counts[shortName] || 0) + 1;
    });
    const colors = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
    return Object.entries(counts)
      .map(([name, value], i) => ({
        name,
        value,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [orders]);

  // Compute daily confirmation rate progress
  const targetConfirmationRate = 75;

  return (
    <div className="space-y-6">
      {/* Upper Welcome Banner */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10 space-y-2">
          <h1 className="text-xl md:text-2xl font-bold font-sans tracking-tight text-white m-0">
            Fashwox COD Calling Desk
          </h1>
          <p className="text-slate-400 text-xs max-w-xl leading-relaxed m-0">
            Confirm pending customer Cash-On-Delivery orders, capture automated call logs, and use modern Gemini summaries to clean your delivery pipeline in real-time.
          </p>
        </div>
        <button
          onClick={onNavigateToCalling}
          id="btn-quick-call"
          className="relative z-10 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm transition-all hover:scale-[1.01] flex items-center gap-1.5 self-start md:self-auto shrink-0 border-0 cursor-pointer"
        >
          <PhoneCall size={14} />
          Start Confirms Dialer
        </button>
        {/* Decorative subtle lines */}
        <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-indigo-550/10 to-transparent blur-xl"></div>
      </div>

      {/* Primary Analytics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Card 1 */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <ListOrdered size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Total COD Orders
            </p>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-white m-0 tracking-tight font-mono">
              {stats.totalOrders}
            </h3>
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
            <Clock size={18} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Pending Dialing
            </p>
            <h3 className="text-base md:text-lg font-bold text-slate-850 dark:text-white m-0 tracking-tight font-mono">
              {stats.pendingCalls}
            </h3>
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CheckCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Confirmed (COD)
            </p>
            <h3 className="text-base md:text-lg font-bold text-slate-850 dark:text-white m-0 tracking-tight font-mono">
              {stats.confirmedOrders}
            </h3>
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
            <XCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Cancelled COD
            </p>
            <h3 className="text-base md:text-lg font-bold text-slate-850 dark:text-white m-0 tracking-tight font-mono">
              {stats.cancelledOrders}
            </h3>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Card 5 */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg">
            <PhoneOff size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              No Answer / Busy
            </p>
            <h3 className="text-sm md:text-base font-bold text-slate-850 dark:text-white m-0 tracking-tight font-mono">
              {stats.noAnswerOrders}
            </h3>
          </div>
        </div>

        {/* Metric Card 6 */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 rounded-lg">
            <PhoneCall size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Callbacks Booked
            </p>
            <h3 className="text-sm md:text-base font-bold text-slate-850 dark:text-white m-0 tracking-tight font-mono">
              {stats.callbackOrders}
            </h3>
          </div>
        </div>

        {/* Metric Card 7 */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-lg">
            <Percent size={18} />
          </div>
          <div className="w-full min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Confirmation Rate
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm md:text-base font-bold text-slate-850 dark:text-white m-0 tracking-tight font-mono">
                {stats.confirmationRate}%
              </h3>
              <span className="text-[9px] text-slate-400">Target {targetConfirmationRate}%</span>
            </div>
            {/* Progress line */}
            <div className="w-full bg-slate-150 dark:bg-slate-850 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.confirmationRate, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Metric Card 8 */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg">
            <BadgeCent size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Confirmed COD Value
            </p>
            <h3 className="text-sm md:text-base font-bold text-slate-850 dark:text-white m-[#0f172a] m-0 tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
              ₹{stats.totalRevenue.toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* Analytics Visual Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Trend Chart */}
        <div className="lg:col-span-2 p-5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white m-0">
              Confirmation / Cancellation Trend
            </h3>
            <span className="text-xs text-slate-400 font-mono">7-Day Roller</span>
          </div>

          <div className="h-64 w-full">
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorConfirmed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCancelled" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" className="dark:hidden" />
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" className="hidden dark:block" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="confirmed"
                    name="Confirmed"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorConfirmed)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cancelled"
                    name="Cancelled"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#colorCancelled)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-mono">
                No trend logs available. Start recording call outcomes!
              </div>
            )}
          </div>
        </div>

        {/* Product Share Widget Pie Chart */}
        <div className="p-5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white m-0">
            Top Performing Catalog
          </h3>

          <div className="h-44 w-full flex items-center justify-center relative">
            {productDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productDistribution}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {productDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '11px',
                      border: '1px solid #1f2937',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-slate-400">Loading catalog items</span>
            )}
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100 font-mono">
                {productDistribution.reduce((acc, curr) => acc + curr.value, 0)}
              </span>
              <span className="text-[10px] text-slate-400">Total Items</span>
            </div>
          </div>

          {/* Pie Chart Legend List Custom */}
          <div className="space-y-1.5 pt-1">
            {productDistribution.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-600 dark:text-slate-350 truncate">{item.name}</span>
                </div>
                <span className="text-slate-700 dark:text-slate-200 font-semibold font-mono">{item.value} units</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* City distribution chart */}
        <div className="lg:col-span-2 p-5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white m-0">
            Regional Confirmation Distribution
          </h3>
          <div className="h-60 w-full">
            {cityDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" className="dark:hidden" />
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" className="hidden dark:block" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '11px',
                      border: '1px solid #1f2937',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="total" name="Total Orders" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="confirmed" name="Confirmed Orders" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Pending regional data upload.
              </div>
            )}
          </div>
        </div>

        {/* Realtime Call Agents status updates */}
        <div className="p-5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white m-0 flex items-center gap-1.5">
                <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                Live Agent Desk
              </h3>
              <span className="flex items-center gap-1 text-[9px] text-emerald-500 font-mono animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                ACTIVE MONITOR
              </span>
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/60 rounded-xl flex items-center justify-between border border-slate-200/40 dark:border-slate-800/65">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    AA
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-white m-0">Alice Agent</h5>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono m-0">In Call (Running)</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Confirmed</span>
                  <span className="text-xs font-bold text-slate-850 dark:text-white font-mono">18 orders</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/60 rounded-xl flex items-center justify-between border border-slate-200/40 dark:border-slate-800/65">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                    BA
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-white m-0">Bob Agent</h5>
                    <p className="text-[10px] text-indigo-650 dark:text-indigo-400 font-mono m-0">Saving Remarks...</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Confirmed</span>
                  <span className="text-xs font-bold text-slate-850 dark:text-white font-mono">14 orders</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50/60 dark:bg-slate-900/60 rounded-xl flex items-center justify-between border border-slate-200/40 dark:border-slate-800/65 opacity-70">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    CR
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800 dark:text-white m-0">Charles Router</h5>
                    <p className="text-[10px] text-slate-500 font-mono m-0">Offline (Shift end)</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Confirmed</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">9 orders</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400 mt-4">
            <span>Overall confirmation percentage</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{stats.confirmationRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
