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
      summary?: string;
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
  // Get active queue
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
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [showRemarksPopup, setShowRemarksPopup] = useState(false);
  const [chosenStatus, setChosenStatus] = useState<OrderStatus>('Confirmed');

  // Dialogue Transcription Stream State
  const [transcriptLines, setTranscriptLines] = useState<{ sender: 'agent' | 'customer'; text: string }[]>([]);

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

  // Helper script maps simulating dial dialogs based on order status choices
  const getTranscriptForDialScenario = (order: Order, statusChoice: OrderStatus) => {
    const name = order.customerName;
    const item = order.productName;
    const amount = order.codAmount.toLocaleString();
    const city = order.city || 'your city';

    if (String(statusChoice).toLowerCase().includes('confirm')) {
      return [
        { time: 2, sender: 'agent' as const, text: `Hello Mr./Ms. ${name}, I am calling from Leopard Luxe Customer Desk regarding your Cash on Delivery order for ${item}.` },
        { time: 5, sender: 'customer' as const, text: `Yes! Hello. I placed that order yesterday.` },
        { time: 10, sender: 'agent' as const, text: `Great! The total cash due is ₹${amount}. I want to verify your delivery coordinates: ${order.address}, ${city} (Pincode: ${order.pincode}). Is it correct?` },
        { time: 15, sender: 'customer' as const, text: `Yes, that address is correct. Can you make sure to deliver it before Saturday afternoon as I have travel plans next week?` },
        { time: 20, sender: 'agent' as const, text: `Absolutely. I've noted down Saturday pre-noon slot in our courier instructions. We are preparing to dispatch immediately.` },
        { time: 25, sender: 'customer' as const, text: `Perfect! Thank you so much for the confirmation call.` },
        { time: 30, sender: 'agent' as const, text: `Our pleasure. Thank you for shopping with Leopard Luxe. Goodbye!` }
      ];
    } else if (String(statusChoice).toLowerCase().includes('cancel')) {
      return [
        { time: 2, sender: 'agent' as const, text: `Hello Mr./Ms. ${name}, calling from Leopard Luxe to verify your active purchase of ${item}.` },
        { time: 5, sender: 'customer' as const, text: `Oh, hello. Actually, I was looking to cancel that order.` },
        { time: 10, sender: 'agent' as const, text: `Oh, I understand. May I ask the reason for cancellation so we can improve size/color listings?` },
        { time: 15, sender: 'customer' as const, text: `Yes, I realized I selected the wrong sizing and color option. I want to cancel and compile a new order instead.` },
        { time: 20, sender: 'agent' as const, text: `No worries at all! I have registered the cancellation request so you can safely repurchase.` },
        { time: 25, sender: 'customer' as const, text: `Great, I will re-order the correct SKU color now. Thanks!` }
      ];
    } else {
      return [
        { time: 2, sender: 'agent' as const, text: `Hello Mr./Ms. ${name}, this is Leopard Luxe customer dispatch confirming your COD shipment of ${item}.` },
        { time: 5, sender: 'customer' as const, text: `Hi! I am super busy right now. Can you call me back tomorrow morning?` },
        { time: 10, sender: 'agent' as const, text: `Of course, I understand! I am scheduling a callback for tomorrow morning.` },
        { time: 15, sender: 'customer' as const, text: `Perfect. Appreciate your understanding. Thank you.` }
      ];
    }
  };

  // Stopwatch counter + dialogue stream controller trigger
  useEffect(() => {
    if (isCalling && !isTimerPaused && activeOrder) {
      const scenario = getTranscriptForDialScenario(activeOrder, chosenStatus);
      
      const interval = setInterval(() => {
        setCallDuration((prev) => {
          const nextSec = prev + 1;
          
          // Append dialog line if timestamp matches
          const line = scenario.find((l) => l.time === nextSec);
          if (line) {
            setTranscriptLines((lines) => [...lines, { sender: line.sender, text: line.text }]);
          }
          
          return nextSec;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isCalling, isTimerPaused, activeOrder, chosenStatus]);

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

  const startDialing = (statusObjective: OrderStatus = 'Confirmed') => {
    if (!activeOrder) return;
    setChosenStatus(statusObjective);
    setRemarksStatus(statusObjective);
    setCallDuration(0);
    setTranscriptLines([]);
    setIsTimerPaused(false);
    setIsCalling(true);
    
    // Fallback tel protocol hook
    window.location.href = `tel:${activeOrder.phoneNumber}`;
  };

  const stopDialing = (suggestedStatus: OrderStatus) => {
    setIsCalling(false);
    setRemarksStatus(suggestedStatus);
    setChosenStatus(suggestedStatus);

    // Formulate a quick helpful remark to populate initially
    let defaultRemarks = '';
    if (suggestedStatus === 'Confirmed') {
      defaultRemarks = 'Customer confirmed order is valid. Verified size details and is ready to accept delivery parcel.';
    } else if (suggestedStatus === 'Cancelled') {
      defaultRemarks = 'Refused confirmation. Wants to replace with another item option due to size mismatch.';
    } else if (suggestedStatus === 'No Answer' || suggestedStatus === 'Busy') {
      defaultRemarks = 'Ringing tone active. Couldn\'t reach client. Rescheduled callbacks.';
    } else {
      defaultRemarks = `Call logged with status outcome: ${suggestedStatus}.`;
    }

    setRemarksText(defaultRemarks);
    setShowRemarksPopup(true);

    // Trigger automatic LLM call summary synthesis immediately
    setTimeout(() => {
      triggerAutomaticAiSummary(suggestedStatus, defaultRemarks);
    }, 150);
  };

  // Background summary generator
  const triggerAutomaticAiSummary = async (status: OrderStatus, comments: string) => {
    if (!activeOrder) return;
    setAiLoading(true);
    setAiSummarySuggestion('');

    const transcriptStr = transcriptLines.map((l) => `${l.sender.toUpperCase()}: ${l.text}`).join('\n') || 'Customer called on dial pad.';

    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: activeOrder.customerName,
          productName: activeOrder.productName,
          codAmount: activeOrder.codAmount,
          duration: callDuration || 25,
          remarks: comments,
          status,
          transcript: transcriptStr,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiSummarySuggestion(data.summary);
      }
    } catch (err) {
      console.error('AI summary fetch error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Simulated Speech remarks voice typing recognizer
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
        const appendText = data.text || 'Dialogue details captured.';
        setRemarksText((prev) => {
          const fresh = prev ? prev + ' ' + appendText : appendText;
          // Re-trigger summary to incorporate voice text
          setTimeout(() => {
            triggerAutomaticAiSummary(remarksStatus, fresh);
          }, 100);
          return fresh;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSpeechTranslating(false);
    }
  };

  // Manual regenerate summary button on popup card
  const handleGenerateAiSummary = () => {
    triggerAutomaticAiSummary(remarksStatus, remarksText);
  };

  // Submit and save comments
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
      summary: aiSummarySuggestion, // Save AI professional summary field
      duration: callDuration || Math.floor(Math.random() * 30) + 15,
    });

    if (success) {
      setShowRemarksPopup(false);
      setRemarksText('');
      setAiSummarySuggestion('');
      setCallDuration(0);

      if (autoMoveToNext) {
        if (activeOrderIndex < activeQueue.length - 1) {
          setActiveOrderIndex(activeOrderIndex + 1);
        } else if (activeQueue.length > 1) {
          setActiveOrderIndex(0); // Wrap
        }
      }
    }
    setIsSubmitting(false);
  };

  // prefilled whatsapp alert
  const openWhatsAppConfirmation = () => {
    if (!activeOrder) return;
    const cleanPhone = activeOrder.phoneNumber.replace(/[^0-9]/g, '');
    const msg = `Hello ${activeOrder.customerName}, your Leopard Luxe COD order for "${activeOrder.productName}" of ₹${activeOrder.codAmount} is confirmed successfully and dispatching shortly. Thank you!`;
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

        <div className="h-[450px] overflow-y-auto space-y-2 pr-1">
          {activeQueue.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <span className="text-3xl">🥳</span>
              <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-205 mt-2 m-0">
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
                    ? 'bg-indigo-50 border-indigo-250 dark:bg-indigo-950/45 dark:border-indigo-805 shadow-sm'
                    : 'bg-white border-slate-100/60 dark:bg-slate-900 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850/40'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {ord.customerName}
                    </span>
                    <span className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                      ord.status === 'Confirmed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : ord.status === 'Cancelled'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                        : 'bg-amber-105 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                    }`}>
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
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden p-6 shadow-sm space-y-5 flex flex-col justify-between"
            >
              {/* Header profile details block */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white m-0">
                      {activeOrder.customerName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                      Queue #{activeOrderIndex + 1}
                    </span>
                    {isCalling && (
                      <button
                        onClick={() => setIsTimerPaused(!isTimerPaused)}
                        title={isTimerPaused ? "Resume Call Timer" : "Pause Call Timer"}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                          isTimerPaused
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-500/20'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450 border-emerald-500/20'
                        }`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${isTimerPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                        <span>{isTimerPaused ? 'PAUSED' : 'LIVE'}: {formatTime(callDuration)}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 m-0 pt-0.5">
                    Order confirmation desk ID: {activeOrder.id}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={openWhatsAppConfirmation}
                    id="btn-whatsapp"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-xl transition-all border-0 cursor-pointer"
                  >
                    <MessageCircle size={14} />
                    WhatsApp Alert
                  </button>
                  <a
                    href={`tel:${activeOrder.phoneNumber}`}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-405 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 rounded-xl transition-all border-0 no-underline"
                  >
                    <Phone size={14} />
                    Dial Pad
                  </a>
                </div>
              </div>

              {/* Call panel status banner */}
              {isCalling && (
                <div className="p-4 bg-gradient-to-r from-teal-500/10 to-indigo-500/10 border border-indigo-505/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-full animate-bounce">
                      <Phone size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white m-0 tracking-wider">
                        DIRECT CALL SESSION RUNNING
                      </h4>
                      <p className="text-[10px] text-slate-405 m-0">
                        Dialing customer at {activeOrder.phoneNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsTimerPaused(!isTimerPaused)}
                        className={`p-1 px-2.5 text-[10px] font-mono font-bold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isTimerPaused
                            ? 'bg-amber-50 border-amber-305 text-amber-700 hover:bg-amber-100 dark:bg-amber-955/40 dark:border-amber-800 dark:text-amber-300'
                            : 'bg-indigo-50 border-indigo-305 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-955/40 dark:border-indigo-805 dark:text-indigo-305'
                        }`}
                        title={isTimerPaused ? "Resume Call Stopwatch" : "Pause Call Stopwatch"}
                      >
                        {isTimerPaused ? '▶ Resume' : '⏸ Pause'}
                      </button>
                      <div className="text-center font-mono font-bold text-indigo-600 dark:text-indigo-405 min-w-[50px]">
                        {formatTime(callDuration)}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => stopDialing('Confirmed')}
                        className="px-3.5 py-2 text-[10.5px] font-bold text-white bg-emerald-650 hover:bg-emerald-700 rounded-lg cursor-pointer border-0"
                      >
                        Answered (Success)
                      </button>
                      <button
                        onClick={() => stopDialing('No Answer')}
                        className="px-3.5 py-2 text-[10.5px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer border-0"
                      >
                        No Answer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Transcript Stream Panel during call session */}
              {isCalling && (
                <div className="p-4 bg-slate-50 dark:bg-[#0b0f19] border border-slate-205/60 dark:border-slate-850 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-850">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
                      Digital Dialogue Wiretap
                    </span>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wide">
                      Real-time Speech Synthesis
                    </span>
                  </div>

                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {transcriptLines.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs italic font-mono animate-pulse">
                        Waiting for caller response... Connection established.
                      </div>
                    ) : (
                      transcriptLines.map((line, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2 text-xs ${
                            line.sender === 'agent' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {line.sender !== 'agent' && (
                            <div className="w-5.5 h-5.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[9px] shrink-0 font-mono">
                              C
                            </div>
                          )}
                          <div className={`p-2.5 rounded-xl max-w-[80%] leading-relaxed ${
                            line.sender === 'agent'
                              ? 'bg-indigo-650 text-white rounded-tr-none'
                              : 'bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-200 rounded-tl-none'
                          }`}>
                            <span className="font-bold text-[8.5px] uppercase tracking-wider block opacity-75 mb-0.5 font-mono">
                              {line.sender === 'agent' ? 'Internal Agent Desk' : activeOrder.customerName}
                            </span>
                            {line.text}
                          </div>
                          {line.sender === 'agent' && (
                            <div className="w-5.5 h-5.5 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-bold text-[9px] shrink-0 font-mono">
                              A
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Central order data content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Visual spec sheet cards left */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">COD Product Spec</span>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 m-0">
                      {activeOrder.productName}
                    </h4>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Cash amount due (COD)</span>
                    <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 m-0">
                      ₹{activeOrder.codAmount.toLocaleString()}
                    </div>
                  </div>

                  {activeOrder.notes && (
                    <div className="space-y-1 bg-slate-50 dark:bg-slate-850/50 p-3 rounded-xl border border-slate-150/40 dark:border-slate-800/25">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 font-mono">
                        <FileText size={10} />
                        Original Customer Notes
                      </span>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed m-0 italic">
                        "{activeOrder.notes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Delivery details sheet right */}
                <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-850/25 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    COD Delivery Address
                  </span>

                  <div className="flex gap-2 text-xs">
                    <MapPin className="text-indigo-650 dark:text-indigo-400 shrink-0 mt-0.5" size={15} />
                    <div className="text-slate-700 dark:text-slate-300">
                      <p className="font-semibold m-0">{activeOrder.address}</p>
                      <p className="m-0 mt-1">
                        {activeOrder.city}, {activeOrder.state} - {activeOrder.pincode}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-400 block pb-0.5">Registry Date</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-350 font-mono">
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
                <div className="flex flex-wrap gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-850">
                  <button
                    onClick={() => startDialing('Confirmed')}
                    id="btn-trigger-dialing"
                    className="flex-1 py-3 px-4 font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
                  >
                    <Phone size={15} />
                    Call Now
                  </button>

                  <div className="flex gap-1.5 w-full sm:w-auto">
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
                      className="flex-1 sm:flex-none px-4 py-3 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 rounded-xl transition-colors cursor-pointer border-0"
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

      {/* CALL REMARKS & AI SUMMARY POPUP MODAL */}
      <AnimatePresence>
        {showRemarksPopup && activeOrder && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {/* Header profile summary detail */}
              <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
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
                  className="p-1 text-slate-400 hover:text-slate-605 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border-0 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form Input Container body */}
              <div className="p-5 space-y-4">
                
                {/* Stats recap row info */}
                <div className="p-3 bg-indigo-500/5 dark:bg-indigo-950/20 rounded-xl border border-indigo-500/5 grid grid-cols-2 gap-2 text-center text-xs">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold mb-0.5">Call duration</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-150">
                      {callDuration > 0 ? `${callDuration} seconds` : 'Manual dial registration'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold mb-0.5">Product SKU</span>
                    <span className="truncate block font-semibold text-slate-800 dark:text-slate-200 text-[10px] px-1 font-mono">
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
                    onChange={(e) => {
                      const newStatus = e.target.value as OrderStatus;
                      setRemarksStatus(newStatus);
                      triggerAutomaticAiSummary(newStatus, remarksText);
                    }}
                    className="w-full text-xs font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-white rounded-xl p-2.5 outline-none transition-colors cursor-pointer"
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
                      Calling Notes & General Remarks
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
                        title="Recompile professional summary using Gemini AI API"
                        className="flex items-center gap-1 text-[10px] text-purple-650 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-305 bg-purple-50/50 dark:bg-purple-950/20 px-2.5 py-1 rounded-lg border-0 font-extrabold transition-all cursor-pointer shadow-sm"
                      >
                        <Sparkles size={10} className="animate-pulse" />
                        <span>Recompute AI Summary</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={remarksText}
                    onChange={(e) => setRemarksText(e.target.value)}
                    placeholder="Write client confirmation remarks (e.g., Checked address details. Customer confirmed size L, ready for Saturday delivery)..."
                    className="w-full text-xs bg-slate-50/50 focus:bg-white dark:bg-slate-850/50 dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-850 dark:text-slate-205 rounded-xl p-2.5 outline-none focus:border-indigo-500 transition-colors"
                  ></textarea>

                  {/* AI Summary outcome loader banner */}
                  {aiLoading && (
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 animate-pulse font-bold flex items-center gap-1 font-mono">
                      <Sparkles size={11} className="animate-spin text-purple-500" />
                      AI Analyst is synthesizing professional summary logs...
                    </div>
                  )}

                  {/* AI PROFESSIONAL SUMMARY EDITABLE PREVIEW CARD */}
                  <div className="space-y-1.5 p-3.5 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 rounded-2xl border border-indigo-500/10">
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest block font-mono">
                      🛡️ AI Professional Call Summary Preview
                    </span>
                    <textarea
                      rows={2}
                      value={aiSummarySuggestion}
                      onChange={(e) => setAiSummarySuggestion(e.target.value)}
                      placeholder="AI compiled professional summary will output here automatically..."
                      className="w-full text-[11px] font-semibold bg-white/60 dark:bg-slate-900/60 border border-slate-200/55 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl p-2 outline-none focus:border-indigo-500"
                    />
                    <p className="text-[9px] text-slate-400 m-0">
                      Editable text block: Captured confirmation status, user concerns/sizing, and next dispatch steps.
                    </p>
                  </div>

                  {/* Quick comment template filters click inputs */}
                  <div className="space-y-1.5 pt-1.5">
                    <span className="text-[9.5px] text-slate-400 uppercase tracking-wider font-bold block">Quick Presets</span>
                    <div className="inline-flex flex-wrap gap-1">
                      {remarkTemplates.map((tpl, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setRemarksText(tpl);
                            triggerAutomaticAiSummary(remarksStatus, tpl);
                          }}
                          className="px-2 py-1 text-[9.5px] text-slate-500 hover:text-indigo-650 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded border border-slate-200/40 dark:border-slate-800/80 transition-colors cursor-pointer shrink-0"
                        >
                          {tpl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Remarks save action footer panel */}
              <div className="p-4 bg-slate-50 dark:bg-slate-850/50 border-t border-slate-150 dark:border-slate-800/85 flex flex-col sm:flex-row justify-between gap-3">
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
                    className="flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-teal-500 hover:from-indigo-500 hover:to-teal-400 rounded-xl shadow-md cursor-pointer disabled:opacity-50 border-0 transition-all font-mono"
                  >
                    <span>Save & Next Customer</span>
                    <ChevronRight size={13} />
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
