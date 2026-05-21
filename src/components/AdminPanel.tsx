/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
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
  HeartHandshake,
  Filter,
  Sparkles,
  CheckCircle,
  XCircle,
  BarChart2,
  ListFilter
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { CallLog, Order } from '../types';

interface AdminPanelProps {
  calls: CallLog[];
  orders: Order[];
  onResetDatabase: () => void;
}

export default function AdminPanel({ calls, orders, onResetDatabase }: AdminPanelProps) {
  // Analytical Filtering States
  const [selectedAgent, setSelectedAgent] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortField, setSortField] = useState<string>('totalCalls');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Quality grading variables
  const [auditScores, setAuditScores] = useState<Record<string, { score: number; evaluation: string }>>({});
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditMode, setAuditMode] = useState<'local' | 'gemini'>('local');

  // Pre-calculate local accuracy quality heuristics
  const computeLocalAccuracy = (c: CallLog) => {
    const text = String(c.remarks || '').trim();
    const status = String(c.status || '').toLowerCase();
    let score = 65;
    let evalMsg = 'Satisfactory communication notes recorded.';

    if (text.length < 10) {
      score -= 25;
      evalMsg = 'Sparse remarks. Suggest appending more conversational details.';
    } else if (text.length > 60) {
      score += 20;
      evalMsg = 'Excellent detail! Accurately notes concerns and customer request specifics.';
    } else if (text.length > 30) {
      score += 10;
      evalMsg = 'Good descriptions outlining clear calling outcomes.';
    }

    if (status.includes('confirm')) {
      if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('dispatch') || text.toLowerCase().includes('yes') || text.toLowerCase().includes('deliver') || text.toLowerCase().includes('size') || text.toLowerCase().includes('pincode')) {
        score += 15;
      } else {
        score -= 10;
        evalMsg += ' Status is Confirmed, but remarks lack verification details.';
      }
    } else if (status.includes('cancel')) {
      if (text.toLowerCase().includes('cancel') || text.toLowerCase().includes('wrong') || text.toLowerCase().includes('refuse') || text.toLowerCase().includes('no') || text.toLowerCase().includes('mistake') || text.toLowerCase().includes('size')) {
        score += 15;
      } else {
        score -= 10;
        evalMsg += ' Status is Cancelled, but notes miss specifying customer reasons.';
      }
    } else if (status.includes('later') || status.includes('callback') || status.includes('busy')) {
      if (text.toLowerCase().includes('call') || text.toLowerCase().includes('later') || text.toLowerCase().includes('tomorrow') || text.toLowerCase().includes('time') || text.toLowerCase().includes('schedule') || text.toLowerCase().includes('busy')) {
        score += 15;
      } else {
        score -= 10;
        evalMsg += ' Rescheduling required, but notes lack precise timestamp plans.';
      }
    }

    return {
      score: Math.max(30, Math.min(100, score)),
      evaluation: evalMsg
    };
  };

  // Pre-set scores whenever calls update
  useEffect(() => {
    const initial: Record<string, { score: number; evaluation: string }> = {};
    calls.forEach((c) => {
      initial[c.id] = computeLocalAccuracy(c);
    });
    setAuditScores((prev) => ({ ...initial, ...prev }));
  }, [calls]);

  // Handle LLM Quality Audit through Gemini
  const triggerGeminiAudit = async () => {
    setIsAuditing(true);
    try {
      const response = await fetch('/api/admin/audit-remarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calls: filteredCalls }),
      });
      if (response.ok) {
        const data = await response.json();
        setAuditScores((prev) => ({ ...prev, ...data.evaluations }));
        setAuditMode('gemini');
      }
    } catch (err) {
      console.error('Failed to run AI quality audit:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  // Extract unique agents found in log profiles
  const uniqueAgents = useMemo(() => {
    const list = new Set<string>();
    calls.forEach((c) => {
      if (c.agentName) list.add(c.agentName);
    });
    return Array.from(list);
  }, [calls]);

  // Apply visual date & agent rules
  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      const matchesAgent = selectedAgent === 'All' || c.agentName === selectedAgent;
      if (!matchesAgent) return false;

      if (startDate) {
        if (new Date(c.timestamp) < new Date(startDate)) return false;
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (new Date(c.timestamp) > endOfDay) return false;
      }
      return true;
    });
  }, [calls, selectedAgent, startDate, endDate]);

  // Global filtered analytics metrics
  const globalMetrics = useMemo(() => {
    const totalCalls = filteredCalls.length;
    const confirmed = filteredCalls.filter((c) => c.status === 'Confirmed').length;
    const cancelled = filteredCalls.filter((c) => c.status === 'Cancelled').length;
    const durationSum = filteredCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(durationSum / totalCalls) : 0;
    const confirmationRate = totalCalls > 0 ? Math.round((confirmed / totalCalls) * 100) : 0;

    let totalAccuracySum = 0;
    let accuracyCount = 0;
    filteredCalls.forEach((c) => {
      const audit = auditScores[c.id];
      if (audit) {
        totalAccuracySum += audit.score;
        accuracyCount += 1;
      }
    });
    const avgAccuracy = accuracyCount > 0 ? Math.round(totalAccuracySum / accuracyCount) : 0;

    return {
      totalCalls,
      confirmed,
      cancelled,
      durationSum,
      avgDuration,
      confirmationRate,
      avgAccuracy
    };
  }, [filteredCalls, auditScores]);

  // Aggregate stats per individual agent
  const agentPerformanceList = useMemo(() => {
    const stats: Record<string, {
      name: string;
      totalCalls: number;
      confirmed: number;
      cancelled: number;
      durationSum: number;
      accuracySum: number;
      accuracyCount: number;
    }> = {};

    filteredCalls.forEach((c) => {
      const ag = c.agentName || 'Unassigned Desk';
      if (!stats[ag]) {
        stats[ag] = { name: ag, totalCalls: 0, confirmed: 0, cancelled: 0, durationSum: 0, accuracySum: 0, accuracyCount: 0 };
      }
      stats[ag].totalCalls += 1;
      stats[ag].durationSum += c.duration || 0;
      if (c.status === 'Confirmed') {
        stats[ag].confirmed += 1;
      } else if (c.status === 'Cancelled') {
        stats[ag].cancelled += 1;
      }

      const audit = auditScores[c.id];
      if (audit) {
        stats[ag].accuracySum += audit.score;
        stats[ag].accuracyCount += 1;
      }
    });

    const list = Object.values(stats).map((s) => {
      const avgDuration = s.totalCalls > 0 ? Math.round(s.durationSum / s.totalCalls) : 0;
      const confirmationRate = s.totalCalls > 0 ? Math.round((s.confirmed / s.totalCalls) * 100) : 0;
      const remarksAccuracy = s.accuracyCount > 0 ? Math.round(s.accuracySum / s.accuracyCount) : 75;
      const durationHours = Math.floor(s.durationSum / 3600);
      const durationMinutes = Math.floor((s.durationSum % 3600) / 60);
      const timeSpentFormatted = durationHours > 0 ? `${durationHours}h ${durationMinutes}m` : `${durationMinutes}m`;

      return {
        name: s.name,
        totalCalls: s.totalCalls,
        confirmed: s.confirmed,
        cancelled: s.cancelled,
        totalDurationSeconds: s.durationSum,
        timeSpentString: timeSpentFormatted,
        avgDuration,
        confirmationRate,
        accuracyAverage: remarksAccuracy,
      };
    });

    // Sorting implementation
    return list.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

  }, [filteredCalls, auditScores, sortField, sortAsc]);

  // Aggregate Calls Status distributions
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCalls.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredCalls]);

  const COLORS = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b'];

  const formatTotalTimeSpent = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // CSV Exporter for audited call logs
  const handleExportRemarksCSV = () => {
    const headers = [
      'Call Log ID',
      'Order ID',
      'Agent Name',
      'Customer Number',
      'Call Outcome Status',
      'Original Call Remarks',
      'AI Call Summary',
      'Duration (sec)',
      'Call Time',
      'Evaluation Remarks Score',
      'AI/Local Quality Review',
      'Timestamp'
    ];

    const csvRows = filteredCalls.map((c) => {
      const review = auditScores[c.id] || { score: 'N/A', evaluation: 'Unevaluated' };
      return [
        c.id,
        c.orderId,
        c.agentName,
        c.phoneNumber,
        c.status,
        c.remarks,
        c.summary || 'N/A',
        c.duration,
        c.callTime,
        review.score,
        review.evaluation,
        c.timestamp
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...csvRows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fashwox_call_analytics_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION HEADER BLOCK */}
      <div className="bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white m-0 uppercase tracking-wider">
              Agent Performance Analytics
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 m-0 mt-1">
            Real-time and historic calling metric scorecards, remarks accuracy tracking, and conversion rates comparison.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleExportRemarksCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-900 rounded-xl border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
          >
            <Download size={13} />
            Export Audit Report
          </button>
          
          <button
            onClick={onResetDatabase}
            className="px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50/50 hover:bg-rose-100/50 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer border-0"
          >
            Reset Database Seed
          </button>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-3">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
          <Filter size={11} />
          Analytics Filters
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Agent selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 block">Assigned Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 p-2 rounded-lg cursor-pointer outline-none"
            >
              <option value="All">All Registered Agents ({uniqueAgents.length})</option>
              {uniqueAgents.map((ag) => (
                <option key={ag} value={ag}>{ag}</option>
              ))}
            </select>
          </div>

          {/* Date range - Start */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 block">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white p-2 rounded-lg outline-none cursor-pointer"
            />
          </div>

          {/* Date range - End */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-500 block">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white p-2 rounded-lg outline-none cursor-pointer"
            />
          </div>

        </div>

        {/* Filters status feedback */}
        {(startDate || endDate || selectedAgent !== 'All') && (
          <div className="flex justify-between items-center bg-indigo-500/5 px-3 py-1.5 rounded-lg text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
            <span>
              Active Filter: {selectedAgent !== 'All' ? `Agent: ${selectedAgent}` : 'All Agents'} 
              {startDate ? ` from ${startDate}` : ''} 
              {endDate ? ` to ${endDate}` : ''} • Showing {filteredCalls.length} calling sessions
            </span>
            <button
              onClick={() => {
                setSelectedAgent('All');
                setStartDate('');
                setEndDate('');
              }}
              className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 underline bg-transparent border-0 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* EXECUTIVE REAL-TIME METRICS HUD */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        
        {/* Metric 1: Total Calls Made */}
        <div className="p-3.5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Calls Made
          </span>
          <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
            {globalMetrics.totalCalls}
          </div>
          <span className="text-[9px] text-slate-450 block mt-0.5">Dialed sessions</span>
        </div>

        {/* Metric 2: Orders Confirmed */}
        <div className="p-3.5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Confirmed
          </span>
          <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {globalMetrics.confirmed}
          </div>
          <span className="text-[9px] text-slate-450 block mt-0.5">Orders verified</span>
        </div>

        {/* Metric 3: Orders Cancelled */}
        <div className="p-3.5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Cancelled
          </span>
          <div className="text-lg font-bold font-mono text-rose-500">
            {globalMetrics.cancelled}
          </div>
          <span className="text-[9px] text-slate-450 block mt-0.5">Dispatches cancelled</span>
        </div>

        {/* Metric 4: Avg Call Duration */}
        <div className="p-3.5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Avg Duration
          </span>
          <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {globalMetrics.avgDuration}s
          </div>
          <span className="text-[9px] text-slate-450 block mt-0.5">Per client dial</span>
        </div>

        {/* Metric 5: Confirmation Conversion Rate */}
        <div className="p-3.5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Conv. Rate
          </span>
          <div className="text-lg font-bold font-mono text-indigo-500">
            {globalMetrics.confirmationRate}%
          </div>
          <span className="text-[9px] text-slate-450 block mt-0.5">Confirmed / Total</span>
        </div>

        {/* Metric 6: Call Remarks Accuracy */}
        <div className="p-3.5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm text-center flex flex-col justify-between relative overflow-hidden">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Remarks Acc.
            </span>
            <div className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">
              {globalMetrics.avgAccuracy}%
            </div>
          </div>
          <span className="text-[8px] text-purple-500 bg-purple-500/10 rounded px-1 self-center mt-1 uppercase font-bold tracking-wider font-mono">
            {auditMode === 'gemini' ? 'AI Audited' : 'Standard Rules'}
          </span>
        </div>

        {/* Metric 7: Time spent on calls */}
        <div className="p-3.5 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Total Time
          </span>
          <div className="text-xs md:text-sm font-black font-mono text-slate-800 dark:text-slate-105 pt-1">
            {formatTotalTimeSpent(globalMetrics.durationSum)}
          </div>
          <span className="text-[9px] text-slate-450 block mt-0.5">Hours & minutes spent</span>
        </div>

      </div>

      {/* CORE DATA VISUALIZATION SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Agent comparison total calls, confirmed and cancelled */}
        <div className="bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-850 dark:text-white m-0 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 size={14} className="text-indigo-500" />
              Agent Workload & Confirms Efficiency
            </h4>
            <span className="text-[10px] text-slate-400">Comparing total dials, confirmed dispatches, and cancels per user</span>
          </div>

          <div className="h-64">
            {agentPerformanceList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
                No calling metrics available inside the current filter conditions.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentPerformanceList}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e384d" opacity={0.15} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11, color: '#f8fafc' }} />
                  <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="totalCalls" name="Total Calls" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="confirmed" name="Confirmed" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Confirmation Rate vs. Remarks Accuracy mapping line */}
        <div className="bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-850 dark:text-white m-0 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={14} className="text-purple-500" />
              Sales Conversions vs Remarks Integrity
            </h4>
            <span className="text-[10px] text-slate-405">Evaluating the confirmation rates against the completeness score of calling notes</span>
          </div>

          <div className="h-64">
            {agentPerformanceList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
                No performance data inside the current filter conditions.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={agentPerformanceList}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e384d" opacity={0.15} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11, color: '#f8fafc' }} />
                  <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="confirmationRate" name="Confirmation Rate (%)" stroke="#10b981" strokeWidth={2} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="accuracyAverage" name="Remarks Accuracy (%)" stroke="#a855f7" strokeWidth={2} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* AGENT PERFORMANCE TABLES SECTION */}
      <div className="bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/50 dark:bg-slate-850/20 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white m-0 uppercase tracking-wider">
              Agent Leaderboard Comparison
            </h4>
            <span className="text-[10px] text-slate-400">
              Click column headers to sort metrics lists of active calling benches
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold rounded-lg border border-indigo-500/10">
            Active Agents: {agentPerformanceList.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/50 dark:bg-slate-950/20 text-slate-400 text-[10px] uppercase font-bold tracking-wider select-none border-b border-slate-100 dark:border-slate-800/80">
                <th onClick={() => toggleSort('name')} className="py-3.5 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                  Agent Name <ArrowUpDown size={11} className="inline ml-1" />
                </th>
                <th onClick={() => toggleSort('totalCalls')} className="py-3.5 px-4 text-center cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                  Total Calls <ArrowUpDown size={11} className="inline ml-1" />
                </th>
                <th onClick={() => toggleSort('confirmed')} className="py-3.5 px-4 text-center cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                  Confirmed <ArrowUpDown size={11} className="inline ml-1" />
                </th>
                <th onClick={() => toggleSort('cancelled')} className="py-3.5 px-4 text-center cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                  Cancelled <ArrowUpDown size={11} className="inline ml-1" />
                </th>
                <th onClick={() => toggleSort('confirmationRate')} className="py-3.5 px-4 text-center cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                  Confirmation Rate <ArrowUpDown size={11} className="inline ml-1" />
                </th>
                <th onClick={() => toggleSort('avgDuration')} className="py-3.5 px-4 text-center cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                  Avg Duration <ArrowUpDown size={11} className="inline ml-1" />
                </th>
                <th onClick={() => toggleSort('totalDurationSeconds')} className="py-3.5 px-4 text-center cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                  Total Call Time <ArrowUpDown size={11} className="inline ml-1" />
                </th>
                <th onClick={() => toggleSort('accuracyAverage')} className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                  Remarks Accuracy <ArrowUpDown size={11} className="inline ml-1" />
                </th>
              </tr>
            </thead>
            <tbody>
              {agentPerformanceList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center font-mono text-slate-400">
                    No matching performance statistics found.
                  </td>
                </tr>
              ) : (
                agentPerformanceList.map((ag) => (
                  <tr
                    key={ag.name}
                    className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 text-slate-650 dark:text-slate-300 transition-colors"
                  >
                    {/* Agent Name */}
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                      {ag.name}
                    </td>

                    {/* Total Calls */}
                    <td className="py-3 px-4 text-center font-semibold font-mono">
                      {ag.totalCalls}
                    </td>

                    {/* Confirmed */}
                    <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                      {ag.confirmed}
                    </td>

                    {/* Cancelled */}
                    <td className="py-3 px-4 text-center text-rose-500 font-bold font-mono">
                      {ag.cancelled}
                    </td>

                    {/* Confirmation Rate progress bar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 justify-center">
                        <span className="font-bold font-mono w-8 text-right">{ag.confirmationRate}%</span>
                        <div className="w-16 bg-slate-150 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden shrink-0">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${ag.confirmationRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Avg Duration */}
                    <td className="py-3 px-4 text-center font-semibold font-mono">
                      {ag.avgDuration}s
                    </td>

                    {/* Total Call Time */}
                    <td className="py-3 px-4 text-center font-semibold font-mono">
                      {ag.timeSpentString}
                    </td>

                    {/* Remarks Accuracy score with visual safety lights */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          ag.accuracyAverage >= 85
                            ? 'bg-emerald-500'
                            : ag.accuracyAverage >= 65
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}></span>
                        <span className="font-bold font-mono text-purple-600 dark:text-purple-400">
                          {ag.accuracyAverage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL CALL REMARKS EVALUATION & AI AUDITING LAB */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Quality Audit Dashboard Panel */}
        <div className="md:col-span-1 bg-gradient-to-br from-indigo-950/70 to-slate-900 border border-indigo-500/20 p-5 rounded-2xl text-slate-100 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Quality Lab</span>
            <h4 className="text-sm font-bold tracking-wider text-white m-0 flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-400" />
              AI Compliance Auditor
            </h4>
            <p className="text-[10.5px] text-slate-350 leading-relaxed m-0">
              Run real-time calling quality audits against agent records using Gemini. This validates if written client notes align properly with confirmation logs and include action metrics.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1.5">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-widest">Active Standard:</span>
              <div className="text-xs font-semibold text-slate-205">
                {auditMode === 'gemini' 
                  ? 'Gemini LLM Remarks Completeness Audit'
                  : 'Predefined Semantic Criteria Filter'}
              </div>
              <p className="text-[9px] text-slate-400 leading-normal m-0 pt-0.5">
                Evaluation checks for order confirmation reasons, customer preferences, size changes, and precise rescheduling hours.
              </p>
            </div>

            <button
              onClick={triggerGeminiAudit}
              disabled={isAuditing || filteredCalls.length === 0}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 rounded-xl font-bold text-xs text-white shadow-md flex items-center justify-center gap-1.5 select-none cursor-pointer border-0"
            >
              {isAuditing ? (
                <>
                  <Activity size={13} className="animate-spin text-purple-200" />
                  <span>Evaluating with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Execute LLM Compliance Audit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Detailed Remarks Quality Evaluation Table */}
        <div className="md:col-span-2 bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-905 dark:text-white m-0 uppercase tracking-wider">
                Call Remarks Compliance Grade
              </h4>
              <span className="text-[10px] text-slate-400">
                Audited scores and textual clarity evaluation per session profile
              </span>
            </div>
          </div>

          <div className="p-4 overflow-y-auto max-h-80 space-y-2 pr-1">
            {filteredCalls.length === 0 ? (
              <div className="p-10 text-center text-xs font-mono text-slate-400">
                No calling logs captured inside the current date or agent rules.
              </div>
            ) : (
              filteredCalls.map((c) => {
                const quality = auditScores[c.id] || { score: 75, evaluation: 'Calculated using baseline compliance metrics.' };
                return (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/80 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{c.agentName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">• {c.id}</span>
                        <span className="text-[10px] text-slate-400 font-mono">• {c.callTime}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono shrink-0 font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Status: <strong className="text-indigo-600 dark:text-indigo-400">{c.status}</strong>
                        </span>
                        <span className={`px-2 py-0.5 font-bold font-mono text-[10.5px] rounded ${
                          quality.score >= 85 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                            : quality.score >= 65 
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-450'
                        }`}>
                          Grade: {quality.score}/100
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="text-slate-705 dark:text-slate-300 italic m-0">
                        Agent Log: "{c.remarks}"
                      </div>
                      {c.summary && (
                        <div className="text-[10.5px] text-indigo-650 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/20 p-2 rounded-lg border border-indigo-500/5 leading-relaxed font-semibold">
                          <strong className="text-indigo-700 dark:text-indigo-400 text-[10px] block mb-0.5 font-bold uppercase tracking-wide">AI Professional Summary:</strong>
                          "{c.summary}"
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-purple-600 dark:text-purple-300 bg-purple-500/5 p-2 rounded-lg border border-purple-500/5 leading-relaxed font-semibold mt-1">
                      <strong className="text-[9.5px] uppercase font-bold text-purple-700 dark:text-purple-400 block mb-0.5 tracking-wider">Compliance Evaluation:</strong>
                      {quality.evaluation}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-slate-205 dark:border-slate-800 text-[9px] text-slate-400 text-center font-bold tracking-wider uppercase font-mono bg-slate-50/20 dark:bg-slate-950/20">
            🛡️ AI Audit Security Standard Approved Group
          </div>
        </div>

      </div>

    </div>
  );
}
