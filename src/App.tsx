/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  PhoneCall,
  FileSpreadsheet,
  Database,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  User,
  Bell,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Terminal,
  Activity,
  Sparkles,
  ChevronRight,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

import { Order, CallLog, RealtimeStats, OrderStatus, User as AppUser } from './types';
import DashboardView from './components/DashboardView';
import UploadSection from './components/UploadSection';
import CallingPanel from './components/CallingPanel';
import OrderRecords from './components/OrderRecords';
import AdminPanel from './components/AdminPanel';

export default function App() {
  // Theme state switcher (supporting light/dark glassmorphic mode)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Multi-user authentication states
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loginUserId, setLoginUserId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credentialError, setCredentialError] = useState('');

  // Primary data storage
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [stats, setStats] = useState<RealtimeStats>({
    totalOrders: 0,
    pendingCalls: 0,
    confirmedOrders: 0,
    cancelledOrders: 0,
    noAnswerOrders: 0,
    callbackOrders: 0,
    confirmationRate: 0,
    totalRevenue: 0,
  });

  // Action view state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'dialer' | 'orders' | 'upload' | 'admin'>('dashboard');
  const [activeOrderIndex, setActiveOrderIndex] = useState<number>(0);

  // Connection Stream SSE state representation
  const [isLiveSynced, setIsLiveSynced] = useState(false);

  // Toast Alerts engine state
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'info' | 'warn' }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Toast dynamic alert dispatcher helper
  const triggerToast = useCallback((msg: string, type: 'success' | 'info' | 'warn' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch all initial data loaders
  const loadStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Stats loading error:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Orders fetch error:', err);
    }
  };

  const fetchCalls = async () => {
    try {
      const response = await fetch('/api/calls');
      if (response.ok) {
        const data = await response.json();
        setCalls(data);
      }
    } catch (err) {
      console.error('Calls fetch error:', err);
    }
  };

  const reloadData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchOrders(), fetchCalls(), loadStats()]);
    setIsLoading(false);
  }, []);

  // Initialize and register Server-Sent Events (SSE) live pipeline listeners
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onopen = () => {
          setIsLiveSynced(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'connected') {
              console.log('Realtime database sync stream pipeline connected successfully. Client ID:', parsed.id);
            } else if (parsed.type === 'orders_synchronized') {
              fetchOrders();
              loadStats();
              triggerToast('Dynamic Excel bulk sheet list ingested and de-duplicated!', 'success');
            } else if (parsed.type === 'order_updated') {
              fetchOrders();
              loadStats();
              triggerToast(`COD order updated to ${parsed.data.status} by agent!`, 'info');
            } else if (parsed.type === 'call_logged') {
              fetchCalls();
              triggerToast(`Call outcomes logged: "${parsed.data.status || 'Remark outline'}" for ${parsed.data.phoneNumber}`, 'success');
            }
          } catch (e) {
            console.error('Error parsing SSE event details payload stream:', e);
          }
        };

        eventSource.onerror = (err) => {
          console.error('SSE Stream error, closing connection to retry:', err);
          setIsLiveSynced(false);
          eventSource?.close();
          // Auto retry connection in 5s
          setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.error('SSE setup failure exception:', err);
        setIsLiveSynced(false);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [triggerToast]);

  // Load initial backend database data lists
  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Handle saving customer call logs and status changes from dialysis
  const handleLogCall = async (
    orderId: string,
    log: {
      agentName: string;
      status: OrderStatus;
      remarks: string;
      summary?: string;
      duration: number;
      whatsappConfirmationSent?: 'Yes' | 'No' | 'Pending';
      addressVerified?: 'Yes' | 'No' | 'Pending';
    }
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/orders/${orderId}/call-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });

      if (response.ok) {
        // Redundant reload for local fallback states if connection lags
        await reloadData();
        return true;
      }
    } catch (err) {
      console.error('Call logging submit error:', err);
      triggerToast('Server link timed out, please save calling remarks again.', 'warn');
    }
    return false;
  };

  // Seeding test databases reset values
  const handleResetDatabase = async () => {
    try {
      const response = await fetch('/api/admin/reset-data', {
        method: 'POST',
      });
      if (response.ok) {
        await reloadData();
        triggerToast('E-Commerce customer database re-seeded to default demo list!', 'info');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Reset database trigger rejected by server routing rules.', 'warn');
    }
  };

  // Handler login credentials presets auto-fill
  const handlePresetFill = (role: 'admin' | 'agent') => {
    setCredentialError('');
    if (role === 'admin') {
      setLoginUserId('ADMIN');
      setLoginPassword('Sahil@2003');
      triggerToast('Pre-filled Manager credentials!', 'info');
    } else {
      setLoginUserId('Agent108');
      setLoginPassword('Agent@101');
      triggerToast('Pre-filled Co-agent credentials!', 'info');
    }
  };

  // Real credential validation Form Submitter
  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setCredentialError('');

    const cleanUserId = loginUserId.trim();
    const cleanPassword = loginPassword.trim();

    if (!cleanUserId || !cleanPassword) {
      setCredentialError('Please provide both User ID and Password.');
      return;
    }

    if (cleanUserId === 'Agent108' && cleanPassword === 'Agent@101') {
      setCurrentUser({
        id: 'usr_agent_108',
        name: 'Agent 108',
        email: 'agent108@fashwox.co',
        role: 'agent',
        status: 'online',
        lastActive: new Date().toISOString(),
      });
      setRemarksSelection('Agent 108');
      triggerToast('Welcomed Agent 108! Calling workstation authorized.', 'success');
      setActiveTab('dashboard');
    } else if (cleanUserId === 'ADMIN' && cleanPassword === 'Sahil@2003') {
      setCurrentUser({
        id: 'usr_admin',
        name: 'Sahil (Manager)',
        email: 'sahilrawat399@gmail.com',
        role: 'admin',
        status: 'online',
        lastActive: new Date().toISOString(),
      });
      setRemarksSelection('Sahil (Manager)');
      triggerToast('Manager dashboard authorized successfully! Backed by ADMIN node.', 'success');
      setActiveTab('dashboard');
    } else {
      setCredentialError('Invalid ID or Password. Verify details and try again.');
      triggerToast('Authentication failed', 'warn');
    }
  };

  // Custom session agent name references select helper
  const [remarksSelection, setRemarksSelection] = useState('Alice Agent');

  // Trigger loading order in dialer panel list
  const handleSelectOrderInDialer = (orderId: string) => {
    const cleanQueue = orders.filter((o) => o.status === 'Pending' || o.status === 'Callback Later' || o.status === 'No Answer');
    const idx = cleanQueue.findIndex((o) => o.id === orderId);
    if (idx !== -1) {
      setActiveOrderIndex(idx);
    } else {
      // Find directly in active overall orders
      const fallbackIdx = orders.findIndex((o) => o.id === orderId);
      if (fallbackIdx !== -1) {
        setActiveOrderIndex(fallbackIdx);
      }
    }
    setActiveTab('dialer');
    triggerToast('Loaded customer COD profile into Calling Dialer workstation', 'info');
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'bg-[#070a13] text-slate-100' : 'bg-[#f8fafc] text-slate-800'}`}>
      
      {/* Toast alert drawers center HUD */}
      <div className="fixed top-4 right-4 z-50 pointer-events-none space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`p-3 rounded-xl shadow-xl flex items-center gap-3 border text-xs max-w-sm font-semibold pointer-events-auto ${
                toast.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/20'
                  : toast.type === 'warn'
                  ? 'bg-rose-950/90 text-rose-300 border-rose-500/20'
                  : 'bg-indigo-950/90 text-indigo-300 border-indigo-500/20'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle size={15} className="text-emerald-400 shrink-0" />
              ) : toast.type === 'warn' ? (
                <XCircle size={15} className="text-rose-400 shrink-0" />
              ) : (
                <Activity size={15} className="text-indigo-400 shrink-0" />
              )}
              <span className="leading-relaxed">{toast.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* RENDER LOGIN PAGE */}
      {!currentUser ? (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* Aesthetic backing gradient circles */}
          <div className="absolute left-1/4 top-1/4 w-96 h-96 bg-indigo-500/5 blur-3xl rounded-full"></div>
          <div className="absolute right-1/4 bottom-1/4 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full"></div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white/80 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl space-y-6 relative z-10"
          >
            
            {/* Header logo custom visual panel */}
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-600 dark:text-indigo-400 font-bold tracking-wider text-[10px]">
                <Sparkles size={11} />
                SECURE WORKSTATION LOGIN
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-850 dark:text-white m-0">
                Fashwox CRM
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Log in as an authorized Agent or Manager to coordinate list calling, track real-time statistics, and record COD outcomes.
              </p>
            </div>

            {/* Credential login Form */}
            <form onSubmit={handleFormLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="login-id-input">
                  User ID / Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User size={15} />
                  </span>
                  <input
                    id="login-id-input"
                    type="text"
                    required
                    value={loginUserId}
                    onChange={(e) => {
                      setLoginUserId(e.target.value);
                      if (credentialError) setCredentialError('');
                    }}
                    placeholder="Enter your User ID"
                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5" htmlFor="login-password-input">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock size={15} />
                  </span>
                  <input
                    id="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (credentialError) setCredentialError('');
                    }}
                    placeholder="••••••••"
                    className="w-full text-xs pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none rounded-xl text-slate-900 dark:text-white font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-500 cursor-pointer border-0 bg-transparent"
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {credentialError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-650 dark:text-rose-400 rounded-xl text-[11px] font-semibold text-center flex items-center justify-center gap-1.5">
                  <XCircle size={14} className="shrink-0" />
                  <span>{credentialError}</span>
                </div>
              )}

              <button
                id="login-submit-btn"
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl hover:shadow-lg transition-all cursor-pointer border-0 flex items-center justify-center gap-2"
              >
                <span>Authorize & Enter Dashboard</span>
                <ChevronRight size={14} />
              </button>
            </form>

            {/* Simulated preset quick auth triggers */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider text-center">
                Quick-Fill Authorized Presets
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Agent Access Preset */}
                <button
                  type="button"
                  onClick={() => handlePresetFill('agent')}
                  className="p-3 rounded-xl bg-slate-50/60 hover:bg-slate-100/50 dark:bg-slate-900/60 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 text-left cursor-pointer transition-all flex flex-col justify-between h-28 relative overflow-hidden group shadow-sm"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white m-0 flex items-center gap-1.5">
                      <User size={13} className="text-indigo-500" />
                      CO-Agent Access
                    </h4>
                    <p className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-1 mb-0 leading-normal">
                      ID: <span className="font-semibold font-mono text-indigo-600 dark:text-indigo-400">Agent108</span><br />
                      Pass: <span className="font-semibold font-mono text-indigo-600 dark:text-indigo-400">Agent@101</span>
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 mt-2">
                    Click to Pre-fill
                    <ChevronRight size={10} className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>

                {/* Manager Access Preset */}
                <button
                  type="button"
                  onClick={() => handlePresetFill('admin')}
                  className="p-3 rounded-xl bg-slate-50/60 hover:bg-slate-100/50 dark:bg-slate-900/60 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-left cursor-pointer transition-all flex flex-col justify-between h-28 relative overflow-hidden group shadow-sm"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white m-0 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-emerald-500" />
                      Manager Access
                    </h4>
                    <p className="text-[9.5px] text-slate-500 dark:text-slate-400 mt-1 mb-0 leading-normal">
                      ID: <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-450">ADMIN</span><br />
                      Pass: <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-450">Sahil@2003</span>
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-450 flex items-center gap-0.5 mt-2">
                    Click to Pre-fill
                    <ChevronRight size={10} className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </div>
            </div>

            {/* Safety policy warning tag */}
            <div className="flex gap-2 p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 text-left">
              <Terminal className="text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" size={14} />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed m-0">
                <strong>Secured node:</strong> Inputs are verified instantaneously inside this sandbox layer. Make sure to download and backup exported reports regularly.
              </p>
            </div>

          </motion.div>
        </div>
      ) : (
        
        /* CORE APP INTERACTIVITIES CONTAINER */
        <div className="flex flex-col min-h-screen">
          
          {/* Main Top Title Navigation line bar */}
          <header className="border-b border-slate-200/60 dark:border-slate-800/80 bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-lg shadow-sm font-black text-xs tracking-wider uppercase">
                FW
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white m-0 font-sans">
                  Fashwox CRM
                </h1>
                <p className="text-[10px] text-slate-405 m-0 leading-normal flex items-center gap-1.5 font-semibold">
                  {currentUser.role === 'admin' ? 'Administrator' : 'Agent Assigned Desk'} • {currentUser.name}
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </p>
              </div>
            </div>

            {/* Connection sync status & Theme options header widget buttons */}
            <div className="flex items-center gap-2.5 justify-end w-full sm:w-auto">
              
              {/* SSE database live connection alert states */}
              <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg font-mono bg-slate-100/50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800 shrink-0">
                {isLiveSynced ? (
                  <>
                    <Wifi size={10} className="text-emerald-500 animate-pulse" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-[9px]">Live Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={10} className="text-rose-500 animate-pulse" />
                    <span className="text-rose-500 dark:text-rose-400 font-bold uppercase tracking-wider text-[9px]">Paused • Reconnecting</span>
                  </>
                )}
              </div>

              {/* Theme toggler buttons */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100/80 dark:bg-slate-900 rounded-lg cursor-pointer border border-slate-200/40 dark:border-slate-800 transition-colors"
                title="Toggle Dashboard Theme"
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              {/* Reload database states helper */}
              <button
                onClick={reloadData}
                disabled={isLoading}
                className="p-2 text-slate-400 hover:text-emerald-650 dark:hover:text-emerald-450 bg-slate-100/80 dark:bg-slate-900 rounded-lg cursor-pointer border border-slate-200/40 dark:border-slate-800 transition-all"
                title="Refresh active database sync charts"
              >
                <Activity size={14} className={isLoading ? 'animate-spin text-emerald-500' : ''} />
              </button>

              {/* Log out account choice button */}
              <button
                onClick={() => {
                  setCurrentUser(null);
                  triggerToast('Logged out of active calling session.', 'info');
                }}
                className="p-2 text-slate-405 hover:text-red-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer border-0 transition-colors"
                title="Sign out of calling workstation"
              >
                <LogOut size={14} />
              </button>

            </div>

          </header>

          {/* Grid Layout featuring Side navigation and page Tab controllers */}
          <div className="flex-1 flex flex-col md:flex-row">
            
            {/* Sticky high contrast left Sidebar Navigation tabs list */}
            <aside className="w-full md:w-64 border-r border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#070a13] p-4 space-y-4 shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 overflow-x-auto md:overflow-x-visible">
              
              <div className="hidden md:block pb-2 border-b border-slate-200/60 dark:border-slate-800/80">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Calling Dashboard Nav</span>
              </div>

              {/* Tab controller button 1 -> Dashboard view */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-transparent border-transparent text-slate-505 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-900/60'
                }`}
              >
                <LayoutDashboard size={15} />
                <span>Executive Stats</span>
              </button>

              {/* Tab controller button 2 -> Calling Panel workstation */}
              <button
                onClick={() => setActiveTab('dialer')}
                className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeTab === 'dialer'
                    ? 'bg-indigo-650 text-white border-indigo-650 shadow-md'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <PhoneCall size={16} />
                <div className="flex justify-between items-center w-full min-w-0">
                  <span className="truncate">Caller Workstation</span>
                  {stats.pendingCalls > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white font-mono shrink-0">
                      {stats.pendingCalls}
                    </span>
                  )}
                </div>
              </button>

              {/* Tab controller button 3 -> Orders lists records */}
              <button
                onClick={() => setActiveTab('orders')}
                className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-indigo-650 text-white border-indigo-650 shadow-md'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Database size={16} />
                <span>Orders list Database</span>
              </button>

              {/* Tab controller button 4 -> Upload Sheets Batch profile data */}
              <button
                onClick={() => {
                  if (currentUser.role !== 'admin') {
                    triggerToast('CSV sheet batch import restricted to Administration managers.', 'warn');
                    return;
                  }
                  setActiveTab('upload');
                }}
                className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  currentUser.role !== 'admin' ? 'opacity-40 select-none' : ''
                } ${
                  activeTab === 'upload'
                    ? 'bg-indigo-650 text-white border-indigo-650 shadow-md'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <FileSpreadsheet size={16} />
                <span>Upload Bulk Sheets</span>
              </button>

              {/* Tab controller button 5 -> Supervisor Admin audit logs */}
              <button
                onClick={() => {
                  if (currentUser.role !== 'admin') {
                    triggerToast('Supervisor metrics tracking panel restricted to Administration managers.', 'warn');
                    return;
                  }
                  setActiveTab('admin');
                }}
                className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                  currentUser.role !== 'admin' ? 'opacity-40 select-none' : ''
                } ${
                  activeTab === 'admin'
                    ? 'bg-indigo-650 text-white border-indigo-650 shadow-md'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <ShieldCheck size={16} />
                <span>Manager Performance</span>
              </button>

              {/* Custom agent selector footer panel */}
              {currentUser.role === 'admin' && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 hidden md:block space-y-1.5 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Dialer Agent Name</span>
                  <select
                    value={remarksSelection}
                    onChange={(e) => setRemarksSelection(e.target.value)}
                    className="w-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-850 dark:text-white border-0 outline-none p-2 rounded-lg cursor-pointer"
                  >
                    <option value="Alice Agent">Alice Agent (Preset)</option>
                    <option value="Bob Agent">Bob Agent (Preset)</option>
                    <option value="Charles Router">Charles Router</option>
                    <option value="Supervisor AI Desk">Supervisor AI Desk</option>
                  </select>
                </div>
              )}

            </aside>

            {/* Core Body component panel switch screens loader */}
            <main id="main-content" className="flex-1 p-6 md:p-8 overflow-y-auto">
              
              {activeTab === 'dashboard' && (
                <DashboardView
                  orders={orders}
                  calls={calls}
                  stats={stats}
                  onNavigateToCalling={() => setActiveTab('dialer')}
                />
              )}

              {activeTab === 'dialer' && (
                <CallingPanel
                  orders={orders}
                  calls={calls}
                  onLogCall={handleLogCall}
                  activeOrderIndex={activeOrderIndex}
                  setActiveOrderIndex={setActiveOrderIndex}
                  agentName={remarksSelection}
                />
              )}

              {activeTab === 'orders' && (
                <OrderRecords
                  orders={orders}
                  onSelectOrderInDialer={handleSelectOrderInDialer}
                  onResetDatabase={handleResetDatabase}
                />
              )}

              {activeTab === 'upload' && (
                <UploadSection
                  onUploadSuccess={(report) => {
                    reloadData();
                    setActiveTab('orders');
                    triggerToast(`Successfully uploaded spreadsheet file: ${report.added} orders added, skipped ${report.duplicatesSkipped} duplicates!`, 'success');
                  }}
                  isLoading={isLoading}
                />
              )}

              {activeTab === 'admin' && (
                <AdminPanel
                  calls={calls}
                  orders={orders}
                  onResetDatabase={handleResetDatabase}
                />
              )}

            </main>

          </div>

        </div>
      )}
    </div>
  );
}
