/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Download, Check, AlertCircle, Trash2, ListPlus } from 'lucide-react';

interface UploadSectionProps {
  onUploadSuccess: (report: { added: number; duplicatesSkipped: number; totalCount: number }) => void;
  isLoading: boolean;
}

export default function UploadSection({ onUploadSuccess, isLoading }: UploadSectionProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: string } | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download Sample Template CSV helper
  const handleDownloadTemplate = () => {
    const headers = [
      'Customer Name',
      'Phone Number',
      'Product Name',
      'COD Amount',
      'Address',
      'City',
      'State',
      'Pincode',
      'Notes'
    ];
    const sampleRows = [
      ['Aarav Sharma', '+91 9876543210', 'Fashwox Elite Leather Jacket', '4299', 'H.No 104, Sector 15', 'Ghaziabad', 'Uttar Pradesh', '201012', 'Call in the afternoon'],
      ['Diya Patel', '8765432109', 'Fashwox Airflow Trail Sneakers', '2499', 'Flat 4B, Shridhar Apartments', 'Ahmedabad', 'Gujarat', '380015', 'Wants size 8']
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...sampleRows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fashwox_order_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to standardise map row keys
  const mapRowData = (rawRow: any) => {
    const findValue = (keys: string[]) => {
      const match = Object.keys(rawRow).find(rowKey => 
        keys.some(k => rowKey.toLowerCase().replace(/[\s_-]/g, '').includes(k))
      );
      return match ? rawRow[match] : undefined;
    };

    return {
      customerName: findValue(['customername', 'name', 'client', 'username']) || '',
      phoneNumber: String(findValue(['phonenumber', 'phone', 'mobile', 'contact']) || '').trim(),
      productName: findValue(['productname', 'product', 'item', 'sku']) || 'Fashwox E-comm Item',
      codAmount: parseFloat(String(findValue(['codamount', 'amount', 'price', 'cod'])) || '0') || 0,
      address: findValue(['address', 'addressline', 'street', 'location']) || '',
      city: findValue(['city', 'town']) || '',
      state: findValue(['state', 'region']) || '',
      pincode: String(findValue(['pincode', 'pin', 'zip', 'postal']) || '').trim(),
      notes: findValue(['notes', 'note', 'remark', 'customernote', 'comment']) || '',
      status: 'Pending'
    };
  };

  const handleFileProcess = (file: File) => {
    setIsProcessing(true);
    setValidationErrors([]);
    setParsedRows([]);
    setFileDetails({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const binaryStr = e.target?.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Parse raw rows
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        if (rawJson.length === 0) {
          setValidationErrors(['The selected sheet is completely empty. Please load an eligible dataset.']);
          setIsProcessing(false);
          return;
        }

        // Standardise key names and validate
        const mappedList = rawJson.map(mapRowData);
        const errors: string[] = [];
        
        const validatedList = mappedList.filter((row, idx) => {
          const rowNum = idx + 2;
          if (!row.customerName) {
            errors.push(`Row ${rowNum}: Customer Name is missing.`);
          }
          if (!row.phoneNumber) {
            errors.push(`Row ${rowNum}: Phone Number is missing.`);
          }
          return row.customerName && row.phoneNumber;
        });

        if (validatedList.length === 0) {
          errors.push('No valid records found in file. All rows lacked customer names or phone numbers.');
        }

        setValidationErrors(errors.slice(0, 5)); // show max 5 preview errors
        setParsedRows(validatedList);
      } catch (err: any) {
        console.error(err);
        setValidationErrors(['Failed to read file. Please ensure it is a valid .csv, .xls or .xlsx sheet format.']);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setValidationErrors(['FileReader exception while loading the target sheet.']);
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setFileDetails(null);
    setParsedRows([]);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitData = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const response = await fetch('/api/orders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: parsedRows }),
      });

      if (!response.ok) {
        throw new Error('Upload service returned server error');
      }

      const resData = await response.json();
      onUploadSuccess({
        added: resData.added,
        duplicatesSkipped: resData.duplicatesSkipped,
        totalCount: resData.totalCount
      });
      handleReset();
    } catch (err) {
      console.error(err);
      setValidationErrors(['Network failure while submitting bulk order list to Express backend db router.']);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="upload-panel" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      
      {/* Upper header action directions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">
            Excel / CSV Batch Order Importer
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 m-0 leading-relaxed max-w-lg">
            Rapidly import order lines via structured digital sheets. The utility cleans duplicates, validates cell formats, and updates the shared calling queue instantly.
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          id="btn-download-template"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-900/40 rounded-xl border-0 transition-colors cursor-pointer shrink-0"
        >
          <Download size={14} />
          Get Sample Template
        </button>
      </div>

      {!fileDetails ? (
        /* Drag and drop panel wrapper */
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv, .xlsx, .xls"
            className="hidden"
          />
          <div className="p-3 bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 rounded-lg mb-3">
            <Upload size={24} className="stroke-[1.5]" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 m-0">
            Drag and drop your spreadsheet here
          </h4>
          <p className="text-xs text-slate-400 mt-1 mb-2">Or click to select your computer files</p>
          <span className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition-colors border-0">
            Browse Sheets
          </span>
          <span className="text-[10px] text-slate-400 mt-4 block">
            Supports digital CSV files, Excel spreadsheets (.xlsx, .xls)
          </span>
        </div>
      ) : (
        /* Excel File Selected and Preview Panel */
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-800 p-4 bg-slate-50/20 dark:bg-slate-950/20">
          <div className="flex items-center justify-between p-3 bg-indigo-50/40 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <FileSpreadsheet size={18} />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-205 m-0 truncate">
                  {fileDetails.name}
                </h5>
                <p className="text-[10px] text-slate-400 font-mono m-0">{fileDetails.size}</p>
              </div>
            </div>
            
            <button
              onClick={handleReset}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors border-0 cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Verification reports listing validation state */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">File Analysis Checklist</span>
              <span className="text-slate-400">{parsedRows.length} valid rows found</span>
            </div>

            {/* If warning anomalies exists show here */}
            {validationErrors.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl text-amber-800 dark:text-amber-400 space-y-1.5 border border-amber-200/20">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <AlertCircle size={14} />
                  <span>Validation Warning Notes</span>
                </div>
                <ul className="list-disc pl-4 text-[10px] space-y-1 m-0">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sandbox sheet validator columns mapping display */}
            {parsedRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-[10px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-800">
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Mobile Contact</th>
                      <th className="py-2 px-3">COD Item SKU</th>
                      <th className="py-2 px-3">COD Cost</th>
                      <th className="py-2 px-3">City Region</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 4).map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-850/30 text-slate-650 dark:text-slate-350 bg-white dark:bg-slate-900">
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{row.customerName}</td>
                        <td className="py-2 px-3 font-mono">{row.phoneNumber}</td>
                        <td className="py-2 px-3 truncate max-w-[120px]">{row.productName}</td>
                        <td className="py-2 px-3 font-semibold font-mono text-emerald-600 dark:text-emerald-450">₹{row.codAmount}</td>
                        <td className="py-2 px-3">{row.city || 'N/A'}, {row.pincode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 4 && (
                  <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50/50 dark:bg-slate-850/10 hover:bg-slate-50 dark:hover:bg-slate-850/20 transition-colors">
                    And {parsedRows.length - 4} more order queues mapped...
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2 justify-end">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border-0 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitData}
              disabled={parsedRows.length === 0 || isLoading || isProcessing}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl shadow-md cursor-pointer disabled:opacity-50 border-0 transition-opacity"
            >
              <ListPlus size={14} />
              Confirm & Push to DB
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
