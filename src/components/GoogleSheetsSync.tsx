/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Link2,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  Sliders,
  Sparkles,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { Order } from '../types';
import { REQUIRED_HEADERS, forceSyncAllToSpreadsheet } from '../lib/googleSheets';

interface GoogleSheetsSyncProps {
  orders: Order[];
  connectedSheets: string[];
  googleUser: any;
  googleToken: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onAddSheet: (idOrUrl: string) => void;
  onRemoveSheet: (id: string) => void;
  triggerToast: (msg: string, type?: 'success' | 'info' | 'warn') => void;
}

export default function GoogleSheetsSync({
  orders,
  connectedSheets,
  googleUser,
  googleToken,
  onSignIn,
  onSignOut,
  onAddSheet,
  onRemoveSheet,
  triggerToast
}: GoogleSheetsSyncProps) {
  const [sheetInput, setSheetInput] = useState('');
  const [isSyncingAll, setIsSyncingAll] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetInput.trim()) return;
    onAddSheet(sheetInput);
    setSheetInput('');
  };

  const handleFullSync = async (sheetId: string) => {
    if (!googleToken) {
      triggerToast('Please authenticate with Google first.', 'warn');
      return;
    }
    
    setIsSyncingAll(sheetId);
    triggerToast(`Initializing full CRM push for sheet range...`, 'info');
    
    try {
      const syncedCount = await forceSyncAllToSpreadsheet(googleToken, sheetId, orders);
      if (syncedCount > 0) {
        triggerToast(`Successfully synced and formatted ${syncedCount} order rows on the Google Sheet!`, 'success');
      } else {
        triggerToast('Failed to write values. Verify Google Sheet has public edits enabled.', 'warn');
      }
    } catch (err) {
      console.error(err);
      triggerToast('An error occurred during bulk sync.', 'warn');
    } finally {
      setIsSyncingAll(null);
    }
  };

  return (
    <div id="google-sheets-panel" className="space-y-6">
      
      {/* Introduction Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <FileSpreadsheet size={160} className="text-indigo-400" />
        </div>
        
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold">
            <Sparkles size={13} />
            <span>Real-time Workspace Feed</span>
          </div>
          <h2 className="text-2xl font-black text-white m-0 tracking-tight">
            Live Google Sheets Integration
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl m-0">
            Keep your CRM synchronised. This utility streams all call attempts, retry timers, WhatsApp checks, and address verification updates instantly to multiple connected Google Sheets. Any agent activity is updated in real time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Auth Section */}
        <div className="bg-[#121824] border border-slate-800/80 rounded-2xl p-5 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2 m-0 border-b border-slate-800 pb-3">
              <Sliders size={15} className="text-indigo-400" />
              <span>Google Account Authorization</span>
            </h3>

            {googleUser ? (
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-3 p-3 bg-slate-905/40 rounded-xl border border-slate-800">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt="Google User"
                      className="w-10 h-10 rounded-full border border-indigo-500/30"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                      {googleUser.displayName?.charAt(0) || 'G'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-200 block truncate">
                      {googleUser.displayName || 'OAuth Operator'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-450 block truncate">
                      {googleUser.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-emerald-950/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <CheckCircle size={14} className="shrink-0" />
                  <span className="text-[11px] font-medium leading-tight">
                    API token cached in memory. Ready to sync calls!
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed m-0">
                  Authorization is required to write changes to files in Google Drive. Sign in with Google to establish authorization securely.
                </p>
                <div className="flex items-center gap-2 p-2.5 bg-amber-950/10 border border-amber-500/20 rounded-xl text-amber-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="text-[10px] font-mono leading-tight">
                    NO ACTIVE AUTHORIZATION: CRM will update records locally only until signed in.
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 border border-slate-800 p-3 rounded-xl bg-slate-900/40 space-y-1.5 leading-relaxed">
                  <span className="font-bold text-indigo-400 block tracking-tight">💡 Sandbox Frame Advisory:</span>
                  <p className="m-0 text-[10.5px]">
                    If the click doesn't open the Google Sign-In pop-up or displays a message that authorization failed/was dismissed, please click the <strong className="text-white hover:text-indigo-400">"Open in New Tab" ↗</strong> button on the top-right corner of this live preview interface to run the application in a standalone page.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800">
            {googleUser ? (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl hover:text-white transition-all text-xs font-bold border-0 cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut size={14} />
                <span>Sign Out of Google Channels</span>
              </button>
            ) : (
              <button
                onClick={onSignIn}
                className="gsi-material-button w-full cursor-pointer hover:shadow-lg transition-all"
                style={{
                  margin: 0,
                  WebkitBorderRadius: '12px',
                  borderRadius: '12px',
                  WebkitBoxSizing: 'border-box',
                  boxSizing: 'border-box',
                  backgroundColor: 'white',
                  border: '1px solid #dadce0',
                  color: '#3c4043',
                  direction: 'ltr',
                  fontFamily: '"Google Sans",arial,sans-serif',
                  fontSize: '14px',
                  height: '44px',
                  letterSpacing: '0.25px',
                  outline: 'none',
                  overflow: 'hidden',
                  padding: '0 12px',
                  position: 'relative',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className="gsi-material-button-state" />
                <div
                  className="gsi-material-button-content-wrapper"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    position: 'relative',
                    width: '100%'
                  }}
                >
                  <div
                    className="gsi-material-button-icon"
                    style={{
                      height: '20px',
                      marginRight: '12px',
                      minWidth: '20px',
                      width: '20px'
                    }}
                  >
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      xmlnsXlink="http://www.w3.org/1999/xlink"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span
                    className="gsi-material-button-contents"
                    style={{
                      fontFamily: '"Google Sans",arial,sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1f1f1f',
                      letterSpacing: '0.2px'
                    }}
                  >
                    Authorize Google Channels
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Live Sheet Integrator Management Card */}
        <div className="lg:col-span-2 bg-[#121824] border border-slate-800/80 rounded-2xl p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-350 flex items-center gap-2 m-0 border-b border-slate-800 pb-3 w-full">
              <Link2 size={15} className="text-indigo-400" />
              <span>Connected Spreadsheet Worksheets</span>
            </h3>

            {/* Form to connect sheet */}
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                placeholder="Paste Spreadsheet ID or full document URL..."
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
                id="sheet-id-input"
              />
              <button
                type="submit"
                disabled={!googleUser}
                className="px-4 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-40 disabled:hover:bg-indigo-650 text-white rounded-xl text-xs font-bold border-0 transition-colors cursor-pointer shrink-0"
              >
                Connect Sheet
              </button>
            </form>

            {/* List of active sheets */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {connectedSheets.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No spreadsheets connected. Paste a Spreadsheet Link above.
                </div>
              ) : (
                connectedSheets.map((id, index) => (
                  <div
                    key={id}
                    id={`sheet-tile-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900/50 border border-slate-805 rounded-xl gap-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-450 block truncate max-w-xs md:max-w-md">
                          Spreadsheet: {id}
                        </span>
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 transition-colors"
                          title="Open spreadsheet in new tab"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                      <span className="text-[9px] font-black tracking-wide text-indigo-400 uppercase block mt-1">
                        ● LIVE FEED STREAM ACTIVE
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleFullSync(id)}
                        disabled={!googleToken || isSyncingAll === id}
                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-[10px] font-bold border-0 cursor-pointer flex items-center gap-1.5 transition-all"
                        title="Force sync entire database rows to this sheet"
                      >
                        {isSyncingAll === id ? (
                          <RefreshCw size={10} className="animate-spin text-indigo-400" />
                        ) : (
                          <RefreshCw size={10} />
                        )}
                        <span>Sync All Rows</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveSheet(id)}
                        className="p-1.5 bg-rose-950/15 border border-rose-500/20 hover:border-red-500 hover:bg-red-500 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Disconnect spreadsheet feed"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 bg-slate-950/20 p-2.5 rounded-xl flex items-center gap-2.5">
            <ShieldAlert size={12} className="shrink-0 text-slate-450" />
            <span className="leading-normal">
              Changes like customer status updates, confirmations, call remarks, address verifications and WhatsApp checks will immediately sync with no manual refresh needed!
            </span>
          </div>
        </div>

      </div>

      {/* Spreadsheet Columns format checklist helper */}
      <div className="bg-[#121824] border border-slate-800/80 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-350 m-0 border-b border-slate-800 pb-3 flex items-center gap-2">
          <FileSpreadsheet size={15} className="text-indigo-400" />
          <span>Validated Spreadsheet Columns Matrix Format</span>
        </h3>
        
        <p className="text-xs text-slate-400 m-0 leading-relaxed">
          The connected spreadsheet is monitored and auto-formatted. The active system writes exactly the following 15 columns block-by-block. Do not modify the header text in row 1 of your sheet:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
          {REQUIRED_HEADERS.map((col, i) => (
            <div
              key={col}
              id={`col-format-${i}`}
              className="p-2.5 bg-slate-900 border border-slate-805 rounded-xl flex flex-col justify-center min-w-0"
            >
              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-wider font-mono">
                Col {String.fromCharCode(65 + i)}
              </span>
              <span className="text-[11px] font-black text-slate-300 block truncate mt-1">
                {col}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
