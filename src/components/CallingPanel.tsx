/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  MessageCircle,
  Clock,
  MapPin,
  FileText,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Award,
  AlertOctagon,
  Mic,
  MicOff,
  UserCheck,
  Check,
  X,
  PhoneForwarded,
  Activity,
  ThumbsUp
} from 'lucide-react';
import { Order, OrderStatus, CallLog } from '../types';

interface CallingPanelProps {
  orders: Order[];
  calls: CallLog[];
  onLogCall: (
    orderId: string,
    log: {
      agentName: string;
      status: OrderStatus;
      remarks: string;
      duration: number;
    }
  ) => Promise<boolean>;
  activeOrderIndex: number;
  setActiveOrderIndex: (idx: number) => void;
  agentName: string;
}

export default function CallingPanel({
  orders,
  calls,
  onLogCall,
  activeOrderIndex,
  setActiveOrderIndex,
  agentName,
}: CallingPanelProps) {
  // Get active queue (only search for 'Pending' or actionable orders if possible, or support iterating all orders)
  // Let's filter orders to focus on Pending orders, or allow selecting any order list!
  // It is best to filter down to "Pending" or standard order queues for confirmation calling, with a helpful toggle.
  const [filterPendingOnly, setFilterPendingOnly] = useState(true);

  const activeQueue = React.useMemo(() => {
    if (filterPendingOnly) {
      return orders.filter((o) => o.status === 'Pending' || o.status === 'Callback Later' || o.status === 'No Answer');
    }
    return orders;
  }, [orders, filterPendingOnly]);

  const activeOrder = activeQueue[activeOrderIndex] || null;

  // Active call states
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showRemarksPopup, setShowRemarksPopup] = useState(false);
  const [chosenStatus, setChosenStatus] = useState<OrderStatus>('Confirmed');

  // Remarks Form Values
  const [remarksText, setRemarksText] = useState('');
  const [remarksStatus, setRemarksStatus] = useState<OrderStatus>('Confirmed');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSpeechTranslating, setIsSpeechTranslating] = useState(false);
  const [aiSummarySuggestion, setAiSummarySuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Quick Remark Templates helper
  const remarkTemplates = [
    'Customer confirmed, dispatch SKU immediately.',
    'Wants Saturday morning express delivery.',
    'Address verified, call before delivery.',
    'Wants different color/size, cancel active order.',
    'Wrong address, requested callback with corrections.',
    'Fake order, phone answered by third-party claiming no purchase.'
  ];

  // Duration Timer controller
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isCalling) {
      intervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isCalling]);

  // Adjust Index when active list updates
  useEffect(() => {
    if (activeOrderIndex >= activeQueue.length && activeQueue.length > 0) {
      setActiveOrderIndex(activeQueue.length - 1);
    }
  }, [activeQueue, activeOrderIndex]);

  // Format call stopwatch display
  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const s = secs % 60;
    return `${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startDialing = () => {
    if (!activeOrder) return;
    setIsCalling(true);
    setCallDuration(0);
    
    // Fallback direct mobile dialing anchor trigger (tel protocol trigger)
    // Runs in background to open dialing stack on smartphone apps
    window.location.href = `tel:${activeOrder.phoneNumber}`;
  };

  const stopDialing = (suggestedStatus: OrderStatus) => {
    setIsCalling(false);
    setChosenStatus(suggestedStatus);
    setRemarksStatus(suggestedStatus);
    setShowRemarksPopup(true);
  };

  // Simulated Speech-to-text Remarks voice recognizer
  const handleVoiceRemarksSimulation = async () => {
    setIsSpeechTranslating(true);
    try {
      const res = await fetch('/api/ai/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceDataSample: 'active' }),
      });
      if (res.ok) {
        const data = await res.json();
        setRemarksText((prev) => (prev ? prev + ' ' + data.text : data.text));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSpeechTranslating(false);
    }
  };

  // AI-generated summary completing call remarks using Gemini on Express server
  const handleGenerateAiSummary = async () => {
    if (!activeOrder) return;
    setAiLoading(true);
    setAiSummarySuggestion('');

    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: activeOrder.customerName,
          productName: activeOrder.productName,
          duration: callDuration || 45, // default simulation value if timer not run
          remarks: remarksText || 'Customer asked which delivery service we operate',
          status: remarksStatus,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiSummarySuggestion(data.summary);
        setRemarksText(data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Form submit saving data logs
  const handleSaveRemarks = async (autoMoveToNext: boolean) => {
    if (!activeOrder) return;
    if (!remarksText.trim()) {
      alert('Mandatory field: Please specify Call Remarks outline before logging outcome!');
      return;
    }

    setIsSubmitting(true);
    const success = await onLogCall(activeOrder.id, {
      agentName,
      status: remarksStatus,
      remarks: remarksText,
      duration: callDuration || Math.floor(Math.random() * 30) + 15,
    });

    if (success) {
      setShowRemarksPopup(false);
      setRemarksText('');
      setAiSummarySuggestion('');
      setCallDuration(0);

      if (autoMoveToNext) {
        // Move to the next index or let state flow update
        if (activeOrderIndex < activeQueue.length - 1) {
          setActiveOrderIndex(activeOrderIndex + 1);
        } else if (activeQueue.length > 1) {
          setActiveOrderIndex(0); // wrap to start of pending list
        }
      }
    }
    setIsSubmitting(false);
  };

  // Prefilled WhatsApp confirm order utility
  const openWhatsAppConfirmation = () => {
    if (!activeOrder) return;
    const cleanPhone = activeOrder.phoneNumber.replace(/[^0-9]/g, '');
    const msg = `Hello ${activeOrder.customerName}, your Fashwox COD order for "${activeOrder.productName}" of ₹${activeOrder.codAmount} is confirmed successfully and dispatching shortly. Thank you!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* List sidebar queue navigation */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white m-0">
              COD Calling Queue
            </h4>
            <span className="text-[10px] text-slate-400">
              {activeQueue.length} customers ready to confirm
            </span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
            <input
              type="checkbox"
              checked={filterPendingOnly}
              onChange={(e) => {
                setFilterPendingOnly(e.target.checked);
                setActiveOrderIndex(0);
              }}
              className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Pending Only</span>
          </label>
        </div>

        <div className="h-[430px] overflow-y-auto space-y-2 pr-1">
          {activeQueue.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <span className="text-3xl">🥳</span>
              <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2 m-0">
                Queue Completed!
              </h5>
              <p className="text-[10px] text-slate-400 max-w-[160px] leading-relaxed mt-1">
                Excellent dialer results. Upload a new CSV spreadsheet file to resume confirming.
              </p>
            </div>
          ) : (
            activeQueue.map((ord, i) => (
              <button
                key={ord.id}
                onClick={() => {
                  if (isCalling) {
                    alert('Please complete your active call and write remarks before selecting another customer!');
                    return;
                  }
                  setActiveOrderIndex(i);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center cursor-pointer ${
                  i === activeOrderIndex
                    ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/45 dark:border-indigo-800/80 shadow-sm'
                    : 'bg-white border-slate-100/60 dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850/40'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {ord.customerName}
                    </span>
                    <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold uppercase">
                      {ord.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono m-0 truncate">
                    {ord.productName}
                  </p>
                  <p className="text-[10px] text-slate-500 tracking-wide m-0">
                    {ord.city || 'Standard Address'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold font-mono text-slate-900 dark:text-slate-105 block">
                    ₹{ord.codAmount}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block">
                    Attempts: {ord.callAttempts}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main workspace caller dashboard */}
      <div className="lg:col-span-2 space-y-6">
        <AnimatePresence mode="wait">
          {activeOrder ? (
            <motion.div
              key={activeOrder.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden p-6 shadow-sm space-y-6 flex flex-col justify-between"
            >
              {/* Header profile details block */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0">
                      {activeOrder.customerName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 font-semibold">
                      Queue #{activeOrderIndex + 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-505 dark:text-slate-400 m-0 pt-0.5">
                    Order confirmation desk ID: {activeOrder.id}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={openWhatsAppConfirmation}
                    id="btn-whatsapp"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-xl transition-all border-0 cursor-pointer"
                  >
                    <MessageCircle size={14} />
                    WhatsApp Alert
                  </button>
                  <a
                    href={`tel:${activeOrder.phoneNumber}`}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 dark:text-indigo-405 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 rounded-xl transition-all border-0 no-underline"
                  >
                    <Phone size={14} />
                    Dial Pad
                  </a>
                </div>
              </div>

              {/* Call panel status banner */}
              {isCalling && (
                <div className="p-4 bg-gradient-to-r from-teal-500/10 to-indigo-500/10 border border-indigo-500/25 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-full animate-bounce">
                      <Phone size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white m-0">
                        DIRECT CALL SESSION RUNNING
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium m-0">
                        Dialing customer at {activeOrder.phoneNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center font-mono font-bold text-indigo-600 dark:text-indigo-405">
                      <Clock size={14} className="inline mr-1 text-indigo-400 animate-spin" />
                      {formatTime(callDuration)}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => stopDialing('Confirmed')}
                        className="px-3 py-1.5 text-[10px] font-semibold text-white bg-emerald-650 hover:bg-emerald-700 rounded-lg cursor-pointer border-0"
                      >
                        Answered (Success)
                      </button>
                      <button
                        onClick={() => stopDialing('No Answer')}
                        className="px-3 py-1.5 text-[10px] font-semibold text-white bg-red-650 hover:bg-red-700 rounded-lg cursor-pointer border-0"
                      >
                        No Answer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Central order data content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Visual spec sheet cards left */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">COD Product Spec</span>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 m-0">
                      {activeOrder.productName}
                    </h4>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cash amount due (COD)</span>
                    <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 m-0">
                      ₹{activeOrder.codAmount.toLocaleString()}
                    </div>
                  </div>

                  {activeOrder.notes && (
                    <div className="space-y-1 bg-slate-50 dark:bg-slate-850/50 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800/20">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                        <FileText size={10} />
                        Original Customer Notes
                      </span>
                      <p className="text-[10px] text-slate-650 dark:text-slate-400 leading-relaxed m-0 italic">
                        "{activeOrder.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Delivery details sheet right */}
                <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-850/20 rounded-2xl border border-slate-100/40 dark:border-slate-800/40">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    COD Delivery Address
                  </span>

                  <div className="flex gap-2 text-xs">
                    <MapPin className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={16} />
                    <div className="text-slate-700 dark:text-slate-300">
                      <p className="font-semibold m-0">{activeOrder.address}</p>
                      <p className="m-0 mt-1">
                        {activeOrder.city}, {activeOrder.state} - {activeOrder.pincode}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-400 block pb-0.5">Registry Date</span>
                      <span className="font-medium text-slate-700 dark:text-slate-350">
                        {new Date(activeOrder.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block pb-0.5">Attempted Dials</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-350 font-mono">
                        {activeOrder.callAttempts} times
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Primary Call Controls row buttons */}
              {!isCalling && (
                <div className="flex flex-wrap gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={startDialing}
                    id="btn-trigger-dialing"
                    className="flex-1 py-3 px-4 font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
                  >
                    <Phone size={16} className="animate-pulse" />
                    Place Confirmation Call
                  </button>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => stopDialing('Confirmed')}
                      className="flex-1 sm:flex-none px-4 py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors cursor-pointer border-0"
                    >
                      Quick Confirm
                    </button>
                    <button
                      onClick={() => stopDialing('Cancelled')}
                      className="flex-1 sm:flex-none px-4 py-3 text-xs font-bold text-white bg-rose-650 hover:bg-rose-500 rounded-xl transition-colors cursor-pointer border-0"
                    >
                      Quick Cancel
                    </button>
                    <button
                      onClick={() => stopDialing('No Answer')}
                      className="flex-1 sm:flex-none px-4 py-3 text-xs font-bold text-slate-700 hover:text-slate-850 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer border-0"
                    >
                      No Answer
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4">
              <span className="text-4xl">📭</span>
              <h4 className="text-lg font-bold text-slate-800 dark:text-slate-205 m-0">No Active Profile Selected</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All order confirmations under the current filters are complete! Please upload supplementary e-commerce sheets or uncheck "Pending Only" to review profiles.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* CALL REMARKS POPUP MODAL ENHANCEMENT */}
      <AnimatePresence>
        {showRemarksPopup && activeOrder && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {/* Header profile summary detail */}
              <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white m-0">
                    Call Outcome & Remarks Summary
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono m-0 mt-0.5">
                    Logged to {activeOrder.customerName} ({activeOrder.phoneNumber})
                  </p>
                </div>
                <button
                  onClick={() => setShowRemarksPopup(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border-0 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Input Container body */}
              <div className="p-5 space-y-4">
                
                {/* Stats recap row info */}
                <div className="p-3 bg-indigo-50/10 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/10 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold mb-0.5">Call duration</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-150">
                      {callDuration > 0 ? `${callDuration} seconds` : 'Manual click logs'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold mb-0.5">Agent assigned</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-150">{agentName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold mb-0.5">Product SKU</span>
                    <span className="truncate block font-semibold text-slate-850 dark:text-slate-200 text-[10px] px-1">
                      {activeOrder.productName}
                    </span>
                  </div>
                </div>

                {/* Outcome Selector field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    E-Commerce Dispatch Status outcome
                  </label>
                  <select
                    value={remarksStatus}
                    onChange={(e) => setRemarksStatus(e.target.value as OrderStatus)}
                    className="w-full text-xs font-medium bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-white rounded-xl p-2.5 outline-none focus:border-indigo-505 transition-colors cursor-pointer"
                  >
                    <option value="Confirmed">Confirmed (Prepare Dispatch)</option>
                    <option value="Cancelled">Cancelled (Cancel SKU)</option>
                    <option value="No Answer">No Answer / Voicemail</option>
                    <option value="Busy">Busy / Call Reject</option>
                    <option value="Wrong Number">Wrong / Inactive Mobile Contact</option>
                    <option value="Callback Later">Callback Scheduled Later</option>
                    <option value="Interested">Interested (Double check SKU variant)</option>
                    <option value="Fake Order">Fake Order (Unintentional entry logs)</option>
                  </select>
                </div>

                {/* Remarks comment field with Speech generator widget support */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Outcome Comments / Notes
                    </label>

                    <div className="flex gap-2">
                      {/* Voice transcript buttons */}
                      <button
                        onClick={handleVoiceRemarksSimulation}
                        disabled={isSpeechTranslating}
                        title="Simulate Voice remarks typing"
                        className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-305 bg-indigo-50/50 dark:bg-indigo-950/20 px-2 py-1 rounded-lg border-0 transition-all cursor-pointer"
                      >
                        {isSpeechTranslating ? (
                          <Activity size={10} className="animate-bounce" />
                        ) : (
                          <Mic size={10} />
                        )}
                        <span>Speech Notes</span>
                      </button>

                      {/* Gemini summary helper button */}
                      <button
                        onClick={handleGenerateAiSummary}
                        disabled={aiLoading}
                        title="Draft standard notes using Gemini AI API prompt tool"
                        className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-305 bg-purple-50/50 dark:bg-purple-950/20 px-2 py-1 rounded-lg border-0 font-semibold transition-all cursor-pointer shadow-sm animate-pulse"
                      >
                        <Sparkles size={10} />
                        <span>AI Suggest Notes</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={remarksText}
                    onChange={(e) => setRemarksText(e.target.value)}
                    placeholder="Write client confirmation outcome logs (e.g. Verified pincode address. Ready to dispatch catalog, user noted delivery before afternoon slot...)"
                    className="w-full text-xs bg-slate-50/50 focus:bg-white dark:bg-slate-850/50 dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-850 dark:text-slate-205 rounded-xl p-2.5 outline-none focus:border-indigo-500 transition-colors"
                  ></textarea>

                  {/* AI Summary outcome loader banner */}
                  {aiLoading && (
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 animate-pulse font-medium">
                      AI is evaluating voice logs and agent rough entries to compile an executive delivery remark note...
                    </div>
                  )}

                  {/* Quick comment template filters click inputs */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 tracking-wider font-bold block">Quick Presets</span>
                    <div className="inline-flex flex-wrap gap-1">
                      {remarkTemplates.map((tpl, idx) => (
                        <button
                          key={idx}
                          onClick={() => setRemarksText(tpl)}
                          className="px-2 py-1 text-[9px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-100 dark:border-slate-800 transition-colors cursor-pointer shrink-0"
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Remarks save action footer panel */}
              <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border-t border-slate-150 dark:border-slate-800/80 flex flex-col sm:flex-row justify-between gap-3">
                <button
                  onClick={() => handleSaveRemarks(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-650 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-xl transition-all border-0 cursor-pointer"
                >
                  Save Call Log Only
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRemarksPopup(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors border-0 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveRemarks(true)}
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-1 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-teal-555 hover:from-indigo-500 hover:to-teal-500 rounded-xl shadow-md cursor-pointer disabled:opacity-50 border-0 transition-opacity"
                  >
                    <span>Save & Next Customer</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
