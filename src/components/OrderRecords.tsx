/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Phone,
  MessageCircle,
  Eye,
  Trash2,
  Calendar,
  Layers,
  MapPin,
  ChevronDown,
  RefreshCcw,
  SlidersHorizontal
} from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface OrderRecordsProps {
  orders: Order[];
  onSelectOrderInDialer: (orderId: string) => void;
  onResetDatabase: () => void;
}

export default function OrderRecords({
  orders,
  onSelectOrderInDialer,
  onResetDatabase,
}: OrderRecordsProps) {
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [productFilter, setProductFilter] = useState<string>('All');
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Compute products & cities list dynamically for search dropdown options
  const uniqueProducts = useMemo(() => {
    const list = new Set<string>();
    orders.forEach((o) => {
      const shortName = o.productName.split('(')[0].trim().slice(0, 30);
      list.add(shortName);
    });
    return Array.from(list);
  }, [orders]);

  const uniqueCities = useMemo(() => {
    const list = new Set<string>();
    orders.forEach((o) => {
      if (o.city) list.add(o.city.trim());
    });
    return Array.from(list);
  }, [orders]);

  // Apply Search + Multi-Filters Logic
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // 1. Search text match
      const nameMatch = o.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const phoneMatch = o.phoneNumber.includes(searchTerm);
      const textMatch = nameMatch || phoneMatch;

      // 2. Status match
      const statusMatch = statusFilter === 'All' || o.status === statusFilter;

      // 3. Product match
      const productMatch =
        productFilter === 'All' ||
        o.productName.toLowerCase().includes(productFilter.toLowerCase());

      // 4. City match
      const cityMatch =
        cityFilter === 'All' || (o.city && o.city.trim().toLowerCase() === cityFilter.toLowerCase());

      // 5. Amount match
      const charge = o.codAmount || 0;
      const minMatch = !minAmount || charge >= parseFloat(minAmount);
      const maxMatch = !maxAmount || charge <= parseFloat(maxAmount);
      const amountMatch = minMatch && maxMatch;

      return textMatch && statusMatch && productMatch && cityMatch && amountMatch;
    });
  }, [orders, searchTerm, statusFilter, productFilter, cityFilter, minAmount, maxAmount]);

  // Handle pagination division
  const paginatedOrders = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredOrders.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage) || 1;

  // Export filtered orders list to CSV download natively in client browser
  const handleExportCSV = () => {
    const headers = [
      'Order ID',
      'Customer Name',
      'Phone Number',
      'Product Name',
      'COD Amount',
      'Address',
      'City',
      'State',
      'Pincode',
      'Status',
      'Attempts',
      'Last Called At',
      'Created At'
    ];

    const dataRows = filteredOrders.map((o) => [
      o.id,
      o.customerName,
      o.phoneNumber,
      o.productName,
      o.codAmount,
      o.address,
      o.city || '',
      o.state || '',
      o.pincode || '',
      o.status,
      o.callAttempts,
      o.lastCalledAt || '',
      o.createdAt
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...dataRows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fashwox_crm_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prefilled WhatsApp confirm order utility
  const handleWhatsAppTrigger = (o: Order) => {
    const cleanPhone = o.phoneNumber.replace(/[^0-9]/g, '');
    const msg = `Hello ${o.customerName}, your Fashwox COD order for "${o.productName}" of ₹${o.codAmount} is confirmed successfully and dispatching shortly. Thank you!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Status Badge visual customiser
  const getStatusBadge = (status: OrderStatus) => {
    const mapStyles: Record<
      OrderStatus,
      { bg: string; text: string; dot: string }
    > = {
      Pending: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
      Confirmed: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
      Cancelled: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
      'No Answer': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-350', dot: 'bg-slate-400' },
      Busy: { bg: 'bg-pink-50 dark:bg-pink-950/40', text: 'text-pink-700 dark:text-pink-400', dot: 'bg-pink-500' },
      'Wrong Number': { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
      'Callback Later': { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
      Interested: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
      'Fake Order': { bg: 'bg-yellow-50 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
    };

    const style = mapStyles[status] || mapStyles['Pending'];

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
           {/* Search Toolbar Controls block */}
      <div id="search-nav" className="bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 p-5 rounded-xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          
          {/* Main search text-input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search customers name, phone digits..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200/65 dark:bg-[#070a13] dark:border-slate-800 p-2.5 pl-9 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-805 dark:text-white transition-colors"
            />
          </div>

          <div className="flex gap-2 shrink-0">
            {/* Export list key actions */}
            <button
              onClick={handleExportCSV}
              id="btn-export-csv"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 bg-slate-50 hover:bg-slate-100 dark:bg-[#070a13] dark:hover:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800 transition-colors cursor-pointer"
              title="Export filtered records list to CSV file spreadsheet"
            >
              <Download size={14} />
              Export CSV
            </button>

            {/* Clear Filters / Reseed testing logs database button */}
            <button
              onClick={() => {
                if (confirm('Re-seed Database? All Custom uploaded records will be cleared and replaced with standard high-fidelity mock customers.')) {
                  onResetDatabase();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50/50 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:text-rose-400 rounded-lg hover:text-rose-700 transition-all border border-rose-200/30 dark:border-rose-900/30 cursor-pointer"
            >
              <RefreshCcw size={13} />
              Reset Database
            </button>
          </div>
        </div>

        {/* Filters Multi select controls row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-150 dark:border-slate-800">
          
          {/* Filter 1 -> Status toggle choice */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Status Outcome</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200/65 dark:bg-[#070a13] dark:border-slate-800 outline-none p-2 rounded-lg cursor-pointer text-slate-750 dark:text-slate-200 font-semibold"
            >
              <option value="All">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="No Answer">No Answer</option>
              <option value="Busy">Busy</option>
              <option value="Wrong Number">Wrong Number</option>
              <option value="Callback Later">Callback Later</option>
              <option value="Interested">Interested</option>
              <option value="Fake Order">Fake Order</option>
            </select>
          </div>

          {/* Filter 2 -> Product Catalog list */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Stock SKU Catalog</label>
            <select
              value={productFilter}
              onChange={(e) => {
                setProductFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200/65 dark:bg-[#070a13] dark:border-slate-800 outline-none p-2 rounded-lg cursor-pointer text-slate-750 dark:text-slate-205 font-semibold"
            >
              <option value="All">All variants catalog</option>
              {uniqueProducts.map((p, idx) => (
                <option key={idx} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3 -> City region filter dropdown */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">City Hub</label>
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200/65 dark:bg-[#070a13] dark:border-slate-800 outline-none p-2 rounded-lg cursor-pointer text-slate-750 dark:text-slate-200 font-semibold"
            >
              <option value="All">All regions</option>
              {uniqueCities.map((c, idx) => (
                <option key={idx} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4 / 5 -> Cost due bounds */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">COD Cost bracket range (₹)</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min ₹"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-1/2 text-xs bg-slate-50 border border-slate-200/65 dark:bg-[#070a13] dark:border-slate-800 p-2 rounded-lg outline-none text-slate-805 dark:text-white font-semibold"
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-1/2 text-xs bg-slate-50 border border-slate-200/65 dark:bg-[#070a13] dark:border-slate-800 p-2 rounded-lg outline-none text-slate-805 dark:text-white font-semibold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main interactive data display Table columns */}
      <div className="bg-white dark:bg-[#0f172a]/45 border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/50 dark:bg-slate-850/20 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-750 dark:text-slate-300">
            Showing {filteredOrders.length} matching order records
          </span>
          <span className="text-slate-400">Page {currentPage} of {totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <span className="text-3xl">🧩</span>
              <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200 m-0">No Matching Records</h5>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No orders match your active query filters. Reset search textbox or adjust cost sliders to view profiles.
              </p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-slate-850/40 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-800 text-[10px]">
                  <th className="py-3 px-4">Customer info</th>
                  <th className="py-3 px-4">stock Item details</th>
                  <th className="py-3 px-4">COD Cost due</th>
                  <th className="py-3 px-4">Destiny Region</th>
                  <th className="py-3 px-4">E-comm status</th>
                  <th className="py-3 px-4 text-center">Attempts</th>
                  <th className="py-3 px-4 text-right">Quick dial Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 text-slate-650 dark:text-slate-350 bg-white dark:bg-[#0c1220]/20 transition-colors"
                  >
                    
                    {/* customer detail block cell */}
                    <td className="py-3.5 px-4 font-semibold text-slate-805 dark:text-slate-150">
                      <div>
                        <span className="font-bold text-slate-850 dark:text-slate-150 block text-xs">
                          {o.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono tracking-wide">{o.phoneNumber}</span>
                      </div>
                    </td>

                    {/* product cell SKU */}
                    <td className="py-3.5 px-4">
                      <div className="max-w-[180px] truncate">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block truncate text-xs">{o.productName}</span>
                        <span className="text-[10px] text-slate-400 block truncate font-mono">
                          Registry date:{' '}
                          {new Date(o.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Amount cost cell */}
                    <td className="py-3.5 px-4 font-bold font-mono text-emerald-600 dark:text-emerald-400 text-xs">
                      ₹{o.codAmount.toLocaleString()}
                    </td>

                    {/* Address city pin cell */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-slate-805 dark:text-slate-300 block truncate max-w-[140px] text-xs" title={o.address}>
                          {o.address}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-semibold">{o.city} {o.pincode}</span>
                      </div>
                    </td>

                    {/* status badge cell */}
                    <td className="py-3.5 px-4">{getStatusBadge(o.status)}</td>

                    {/* Call attempts details */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {o.callAttempts}
                    </td>

                    {/* Direct dial workspace action cell */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex gap-1.5">
                        {/* WhatsApp prefix msg */}
                        <button
                          onClick={() => handleWhatsAppTrigger(o)}
                          className="p-1 px-2.5 text-xs text-emerald-600 hover:text-emerald-755 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20 rounded-lg transition-all border-0 cursor-pointer"
                          title="Open WhatsApp with prefilled confirmation text alert"
                        >
                          <MessageCircle size={14} />
                        </button>
                        
                        {/* Select in dialer route button */}
                        <button
                          onClick={() => onSelectOrderInDialer(o.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer border-0 shrink-0"
                          title="Load COD customer order into dialer panel ready to call"
                        >
                          <Phone size={10} />
                          Call Now
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer selector controls pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs bg-slate-50/25 dark:bg-slate-950/10">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer disabled:opacity-40 border-0 text-xs font-semibold"
            >
              Previous
            </button>
            <span className="text-slate-400 text-xs">
              Page <strong className="text-slate-700 dark:text-slate-200 font-bold">{currentPage}</strong> of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer disabled:opacity-40 border-0 text-xs font-semibold"
            >
              Next
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
