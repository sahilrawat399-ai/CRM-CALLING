/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Server,
  Download,
  Info,
  ShieldCheck,
  Smartphone
} from 'lucide-react';

interface SupabaseSyncProps {
  onSuccessSync: () => void;
  triggerToast: (msg: string, type: 'info' | 'success' | 'warn') => void;
}

interface TableStatus {
  ok: boolean;
  error?: string;
}

interface SupabaseStatus {
  connected: boolean;
  url?: string;
  useSupabaseAsPrimary?: boolean;
  allTablesOk?: boolean;
  tables?: {
    orders: TableStatus;
    call_logs: TableStatus;
    status_history: TableStatus;
  };
  error?: string;
}

export default function SupabaseSync({ onSuccessSync, triggerToast }: SupabaseSyncProps) {
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<boolean>(false);

  // Configuration form fields
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [usePrimary, setUsePrimary] = useState(true);

  // SQL code to copy and paste to Supabase Editor
  const sqlSchema = `-- 1. CREATE ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  "id" text PRIMARY KEY,
  "customerName" text NOT NULL,
  "phoneNumber" text NOT NULL,
  "productName" text NOT NULL,
  "codAmount" double precision NOT NULL DEFAULT 0,
  "address" text,
  "city" text,
  "state" text,
  "pincode" text,
  "status" text NOT NULL DEFAULT 'Pending',
  "notes" text,
  "assignedAgentId" text,
  "callAttempts" integer NOT NULL DEFAULT 0,
  "lastCalledAt" text,
  "createdAt" text NOT NULL,
  "paymentMode" text DEFAULT 'COD',
  "retry4HrStatus" text DEFAULT 'Pending',
  "retry4HrTime" text,
  "retryDay2Status" text DEFAULT 'Pending',
  "retryDay2Time" text,
  "whatsappStatus" text DEFAULT 'Pending',
  "addressVerified" text DEFAULT 'Pending'
);

--enable Row Level Security (RLS) safely or disable it for testing
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select of orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert of orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of orders" ON orders FOR UPDATE USING (true);

-- 2. CREATE CALL LOGS TABLE
CREATE TABLE IF NOT EXISTS call_logs (
  "id" text PRIMARY KEY,
  "orderId" text NOT NULL,
  "agentName" text NOT NULL,
  "phoneNumber" text NOT NULL,
  "status" text NOT NULL,
  "remarks" text,
  "summary" text,
  "duration" integer NOT NULL DEFAULT 0,
  "callTime" text NOT NULL,
  "timestamp" text NOT NULL
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select of call_logs" ON call_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert of call_logs" ON call_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of call_logs" ON call_logs FOR UPDATE USING (true);

-- 3. CREATE STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS status_history (
  "id" text PRIMARY KEY,
  "orderId" text NOT NULL,
  "previousStatus" text NOT NULL,
  "newStatus" text NOT NULL,
  "changedBy" text NOT NULL,
  "timestamp" text NOT NULL
);

ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select of status_history" ON status_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert of status_history" ON status_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of status_history" ON status_history FOR UPDATE USING (true);`;

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/supabase/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.url) {
          setUrl(data.url);
        }
        if (data.useSupabaseAsPrimary !== undefined) {
          setUsePrimary(data.useSupabaseAsPrimary);
        }
      }
    } catch (err) {
      console.error('Failed to load Supabase connection state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      triggerToast('Please provide both Project URL and Anon API Key.', 'warn');
      return;
    }

    setActionLoading('saving');
    try {
      const res = await fetch('/api/supabase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          anonKey: anonKey.trim(),
          useSupabaseAsPrimary: usePrimary
        }),
      });

      if (res.ok) {
        triggerToast('Supabase Client Re-initialized successfully!', 'success');
        await fetchStatus();
      } else {
        triggerToast('Failed to apply configuration.', 'warn');
      }
    } catch (err: any) {
      triggerToast(`Config failed: ${err.message}`, 'warn');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMigrate = async () => {
    setActionLoading('migrating');
    try {
      const res = await fetch('/api/supabase/migrate', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        triggerToast(`Migrated data safely: ${result.ordersCount} orders, ${result.callsCount} logs synced.`, 'success');
        onSuccessSync();
        await fetchStatus();
      } else {
        triggerToast(`Migration rejected: ${result.error || 'Check SQL schema setup'}`, 'warn');
      }
    } catch (err: any) {
      triggerToast(`Migration failed: ${err.message}`, 'warn');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePull = async () => {
    setActionLoading('pulling');
    try {
      const res = await fetch('/api/supabase/pull', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        triggerToast(`Pull success! Loaded ${result.ordersCount} orders from Supabase.`, 'success');
        onSuccessSync();
        await fetchStatus();
      } else {
        triggerToast(`Pull failed: ${result.error || 'Ensure remote tables are fully configured'}`, 'warn');
      }
    } catch (err: any) {
      triggerToast(`Pull error: ${err.message}`, 'warn');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopiedIndex(true);
    triggerToast('SQL Schema copied to clipboard!', 'success');
    setTimeout(() => setCopiedIndex(false), 2000);
  };

  return (
    <div className="space-y-6" id="supabase-backend-syncer">
      {/* Premium Header Accent Title */}
      <div className="relative p-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-mono font-bold uppercase tracking-wider">
                Production Backend
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Database className="text-indigo-400" size={24} />
              Supabase Backend Dynamic Connector
            </h2>
            <p className="text-slate-400 text-xs max-w-2xl leading-relaxed">
              Link, stream, and persist Leopard Luxe high-end user logs directly to your custom PostgreSQL instance. Avoid sandbox execution constraints with bulletproof remote infrastructure synchronization.
            </p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Re-probe Connection Health
          </button>
        </div>
        <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-br from-indigo-550/10 to-transparent blur-2xl"></div>
      </div>

      {/* Primary Row Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Connections Status with table checks */}
        <div className="lg:col-span-4 space-y-6">
          {/* Connection status card */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-4">
            <h3 className="text-sm font-bold text-slate-200 tracking-tight flex items-center gap-2 pb-3 border-b border-slate-800">
              <Server size={16} className="text-indigo-400" />
              Dynamic Status Tracker
            </h3>

            {loading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                <RefreshCw className="animate-spin text-indigo-400" size={24} />
                <span className="text-[11px] font-medium animate-pulse">Checking credentials health...</span>
              </div>
            ) : status?.connected ? (
              <div className="space-y-4">
                {/* Visual success alert */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex gap-2.5 items-start">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold tracking-tight block">Supabase Client Connected</span>
                    <p className="text-[10.5px] text-slate-400 m-0 leading-relaxed">
                      Probed project instance successfully at {status.url}. Ready to listen, write, and manage.
                    </p>
                  </div>
                </div>

                {/* Primary Mode Indicator */}
                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl text-xs">
                  <span className="text-slate-450 font-medium">Primary Live Backend:</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    status.useSupabaseAsPrimary 
                      ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {status.useSupabaseAsPrimary ? 'ACTIVATED' : 'LOCAL CACHE ONLY'}
                  </span>
                </div>

                {/* Database Table integrity logs */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">POSTGRES TABLE INTEGRITY</span>
                  <div className="space-y-1.5">
                    {/* Table 1: orders */}
                    <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-900 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-mono font-medium">orders</span>
                      </div>
                      {status.tables?.orders.ok ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold text-[10.5px]">
                          <CheckCircle2 size={13} /> Active
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1 font-bold text-[10.5px]" title={status.tables?.orders.error}>
                          <XCircle size={13} /> Missed
                        </span>
                      )}
                    </div>

                    {/* Table 2: call_logs */}
                    <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-900 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-mono font-medium">call_logs</span>
                      </div>
                      {status.tables?.call_logs.ok ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold text-[10.5px]">
                          <CheckCircle2 size={13} /> Active
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1 font-bold text-[10.5px]" title={status.tables?.call_logs.error}>
                          <XCircle size={13} /> Missed
                        </span>
                      )}
                    </div>

                    {/* Table 3: status_history */}
                    <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-900 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-mono font-medium">status_history</span>
                      </div>
                      {status.tables?.status_history.ok ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold text-[10.5px]">
                          <CheckCircle2 size={13} /> Active
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1 font-bold text-[10.5px]" title={status.tables?.status_history.error}>
                          <XCircle size={13} /> Missed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overall recommendation alert if tables are missing */}
                {!status.allTablesOk && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] rounded-xl space-y-1 leading-relaxed">
                    <span className="font-bold block flex items-center gap-1">
                      <AlertCircle size={14} className="shrink-0" /> Schema Initializer Required
                    </span>
                    <p className="m-0 text-slate-400 text-[10px] leading-relaxed">
                      One or more schema tables were not found in your Supabase database. Please copy the SQL instructions on the right edit pane and run them inside your Supabase <strong>SQL Editor</strong> workspace dashboard.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 border border-slate-800 text-red-400 text-xs rounded-xl flex gap-2 items-start">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="space-y-1 leading-normal">
                    <span className="font-bold block">Offline Local Sandbox Mode</span>
                    <p className="m-0 text-[10.5px] text-slate-400">
                      Failed to bind Supabase client. System is caching changes locally in system sandbox files as fallback.
                    </p>
                  </div>
                </div>
                {status?.error && (
                  <div className="p-2 bg-slate-950 font-mono text-[9.5px] text-slate-500 rounded-lg break-all">
                    {status.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick sync utilities card */}
          {status?.connected && status?.allTablesOk && (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-4">
              <h3 className="text-sm font-bold text-slate-200 tracking-tight flex items-center gap-2 pb-3 border-b border-slate-800">
                <RefreshCw size={16} className="text-indigo-400" />
                Data Migration Pipelines
              </h3>

              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Local to Cloud DB Sync</span>
                  <p className="text-[10.5px] text-slate-400 m-0 leading-relaxed">
                    Push and merge currently active sandbox data records (and default seed data) straight to your cloud Supabase database tables safely.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={actionLoading !== null}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold border-0 transition-all rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <UploadCloud size={14} className={actionLoading === 'migrating' ? 'animate-bounce' : ''} />
                  {actionLoading === 'migrating' ? 'Migrating Data...' : 'Push Local Data to Supabase'}
                </button>

                <div className="pt-4 border-t border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cloud DB overwrite Local cache</span>
                  <p className="text-[10.5px] text-slate-400 m-0 leading-relaxed">
                    Pull, replace, and load all current database contents hosted in remote Supabase tables straight into this web workspace cache memory.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePull}
                  disabled={actionLoading !== null}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold border border-slate-700 transition-all rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download size={14} className={actionLoading === 'pulling' ? 'animate-pulse' : ''} />
                  {actionLoading === 'pulling' ? 'Pulling Data...' : 'Pull Records from Supabase'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Connection settings form OR SQL schema schema instructions */}
        <div className="lg:col-span-8 space-y-6">
          {/* Supabase configuration settings card */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-4">
            <h3 className="text-sm font-bold text-slate-200 tracking-tight flex items-center gap-2 pb-3 border-b border-slate-800">
              <Database size={16} className="text-indigo-400" />
              Dynamic Credentials Bridge (Project: Data-CRM-LUXE)
            </h3>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project URL */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Supabase Project URL</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full text-xs bg-slate-950 font-mono text-indigo-400 border border-slate-800 focus:border-indigo-500/50 outline-none p-3 rounded-xl transition-all"
                  />
                  <p className="text-[10px] text-slate-500 m-0 leading-tight">
                    The backend cleans, canonicalizes, and strips trailing routing suffixes automatically.
                  </p>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Public Anon / Publishable Key</label>
                  <input
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full text-xs bg-slate-950 font-mono text-indigo-400 border border-slate-800 focus:border-indigo-500/50 outline-none p-3 rounded-xl transition-all"
                  />
                  <p className="text-[10px] text-slate-500 m-0 leading-tight">
                    Usually labeled "anon_public" key inside your API Keys dashboard setting.
                  </p>
                </div>
              </div>

              {/* Toggle primary write sync state */}
              <div className="flex items-start justify-between p-3.5 bg-slate-950 rounded-xl text-xs gap-4">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-200 tracking-tight block">Use Supabase for primary persistent storage</span>
                  <p className="text-slate-400 text-[10.5px] m-0 leading-relaxed">
                    When active, all lists, updates, statistics calculations and call activity logs read/write straight to Supabase. Fallback sandbox triggers only if connection issues occur.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUsePrimary(!usePrimary)}
                  className={`px-3 py-1.5 font-bold rounded-lg cursor-pointer transition-all border-0 text-xs ${
                    usePrimary 
                      ? 'bg-indigo-600 hover:bg-indigo-550 text-white' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                  }`}
                >
                  {usePrimary ? 'Active Primary' : 'Local Fallback'}
                </button>
              </div>

              {/* Submit panel */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <Info size={14} className="text-slate-400" />
                  <span>Config resides in local system cache file securely.</span>
                </div>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white border-0 font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-40"
                >
                  {actionLoading === 'saving' ? 'Saving Config...' : 'Bind & Connect Instance'}
                </button>
              </div>
            </form>
          </div>

          {/* Copy-paste SQL instruction box */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-200 tracking-tight flex items-center gap-2">
                <Database size={16} className="text-indigo-400" />
                SQL Table Initializer Schema script
              </h3>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedIndex ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copiedIndex ? 'Copied SQL' : 'Copy Schema Code'}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 leading-normal">
                Don't have your PostgreSQL database tables established yet? Copy the structure SQL schema code block below, paste it into your <strong>Supabase Dashboard ➔ SQL Editor ➔ New Query</strong> workspace window, and click <strong>"Run"</strong>:
              </p>

              <div className="relative">
                <pre className="p-4 bg-slate-950 border border-slate-850 rounded-xl overflow-x-auto text-[9.5px] font-mono text-indigo-300 max-h-56 select-all scrollbar-thin">
                  <code>{sqlSchema}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
