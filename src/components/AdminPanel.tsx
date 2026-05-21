/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  FileText,
  User,
  Clock,
  PhoneCall,
  Calendar,
  Layers,
  ArrowUpDown,
  Download,
  AlertTriangle,
  Award,
  TrendingUp,
  Activity,
  HeartHandshake
} from 'lucide-react';
import { CallLog, Order } from '../types';

interface AdminPanelProps {
  calls: CallLog[];
  orders: Order[];
  onResetDatabase: () => void;
}

export default function AdminPanel({ calls, orders, onResetDatabase }: AdminPanelProps) {
  // Aggregate Agent Stats metric summaries
  const agentPerformance = useMemo(() => {
    const agents: Record<
      string,
      { name: string; totalCalls: number; confirmed: number; cancelled: number; durationSum: number }
    > = {};

    calls.forEach((c) => {
      const ag = c.agentName || 'Agent Code';
      if (!agents[ag]) {
        agents[ag] = { name: ag, totalCalls: 0, confirmed: 0, cancelled: 0, durationSum: 0 };
      }
      agents[ag].totalCalls += 1;
      agents[ag].durationSum += c.duration || 0;
      if (c.status === 'Confirmed') {
        agents[ag].confirmed += 1;
      } else if (c.status === 'Cancelled') {
        agents[ag].cancelled += 1;
      }
    });

    return Object.values(agents).map((a) => {
      const avgDur = a.totalCalls > 0 ? Math.round(a.durationSum / a.totalCalls) : 0;
      const confirmRate = a.totalCalls > 0 ? Math.round((a.confirmed / a.totalCalls) * 100) : 0;
      return {
        ...a,
        avgDur,
        confirmRate,
      };
    });
  }, [calls]);

  // Aggregate Status counts for distribution log lists
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    calls.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [calls]);

  // Export Call Remarks list helper
  const handleExportRemarksCSV = () => {
    const headers = [
      'Call Log ID',
      'Order ID',
      'Agent Name',
      'Customer Number',
      'Call Outcome Status',
      'Remarks / Comments',
      'Duration (sec)',
      'Call Time',
      'Timestamp'
    ];

    const csvRows = calls.map((c) => [
      c.id,
      c.orderId,
      c.agentName,
      c.phoneNumber,
      c.status,
      c.remarks,
      c.duration,
      c.callTime,
      c.timestamp
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...csvRows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fashwox_crm_call_remarks_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Metrics Performance overview rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Total Call events metrics card */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <PhoneCall size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Total Logged Calls
            </p>
            <h3 className="text-base md:text-lg font-bold text-slate-850 dark:text-white m-0 font-mono">
              {calls.length} calls
            </h3>
            <span className="text-[10px] text-slate-400">Total active calling center sessions</span>
          </div>
        </div>

        {/* Global Average session time metrics card */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Clock size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Average Conversation Time
            </p>
            <h3 className="text-base md:text-lg font-bold text-slate-850 dark:text-white m-0 font-mono">
              {calls.length > 0
                ? Math.round(calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length)
                : 0}{' '}
              seconds
            </h3>
            <span className="text-[10px] text-slate-400">Time taken per customer connection</span>
          </div>
        </div>

        {/* Efficiency Converting indicators card */}
        <div className="p-4 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm flex items-center gap-4">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg">
            <Award size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Agent Confirmation conversion
            </p>
            <h3 className="text-base md:text-lg font-bold text-slate-850 dark:text-white m-0 font-mono">
              {calls.length > 0
                ? Math.round((calls.filter((c) => c.status === 'Confirmed').length / calls.length) * 100)
                : 0}
              %
            </h3>
            <span className="text-[10px] text-slate-400">Overall success dispatch yield index</span>
          </div>
        </div>

      </div>

      {/* Grid containing Call Remarks Log items & Agent Performance Metrics tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Agent efficiency score metric listing */}
        <div className="lg:col-span-1 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-white m-0 flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
            <TrendingUp size={14} className="text-indigo-650 dark:text-indigo-400" />
            Agent Efficiency Ratings
          </h4>
          <p className="text-[11px] text-slate-450 leading-relaxed m-0">
            Manager panel audit of conversion rates, call times, and registered feedback loops per user desk.
          </p>

          <div className="space-y-2.5 pt-2">
            {agentPerformance.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-405 font-mono">Pending call events to map performance profiles.</div>
            ) : (
              agentPerformance.map((ag, i) => (
                <div
                  key={i}
                  className="p-3 bg-slate-50/60 dark:bg-slate-900/60 rounded-lg border border-slate-200/40 dark:border-slate-800/65 space-y-2"
                >
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-800 dark:text-slate-250 flex items-center gap-1">
                      <User size={12} className="text-slate-400" />
                      {ag.name}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono text-[10px]">
                      {ag.confirmRate}% Conv Rate
                    </span>
                  </div>

                  <div className="w-full bg-slate-150 dark:bg-slate-850 h-1 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${Math.min(ag.confirmRate, 100)}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-[9px] text-slate-450 font-mono">
                    <span>Calls: {ag.totalCalls} logged</span>
                    <span>Avg call: {ag.avgDur}s</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detailed audit Call Logs and Remarks spreadsheet panel */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-905 dark:text-white m-0 uppercase tracking-wide">
                  Live Dispatch Call Log Entries
                </h4>
                <span className="text-[10px] text-slate-400">
                  Detailed remarks, duration tags, and AI summary records
                </span>
              </div>

              <button
                onClick={handleExportRemarksCSV}
                id="btn-export-remarks"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-500 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-900 dark:text-slate-300 rounded-lg border border-slate-200/40 dark:border-slate-800 transition-colors cursor-pointer"
                title="Download complete call logs and client comments history sheet"
              >
                <Download size={13} />
                Export logs
              </button>
            </div>

            <div className="overflow-y-auto max-h-[380px] space-y-2.5 pr-1">
              {calls.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs font-mono">
                  No historical call logs mapped yet. Confirmed feedback details will append here in real-time.
                </div>
              ) : (
                calls.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800/65 rounded-xl space-y-2 text-xs hover:border-indigo-100/30 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{c.agentName}</span>
                        <span className="text-[10px] text-slate-400">• {c.callTime}</span>
                        <span className="text-[10px] text-slate-450 font-mono">• {c.phoneNumber}</span>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        c.status === 'Confirmed'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : c.status === 'Cancelled'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-450'
                          : 'bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-350'
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    <p className="text-slate-705 dark:text-slate-300 leading-relaxed italic m-0">
                      "{c.remarks}"
                    </p>

                    <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-250/60 dark:border-slate-800/60 font-mono">
                      <span>Log ID: {c.id}</span>
                      <span>Call Duration: {c.duration}s</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-450 text-center uppercase tracking-wider font-bold">
            ⚡ Confirmation Quality Audit Desk
          </div>
        </div>

      </div>

    </div>
  );
}
