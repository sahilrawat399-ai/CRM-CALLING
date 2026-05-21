/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order } from '../types';

export const REQUIRED_HEADERS = [
  'Order Date',
  'Order number',
  'Custommer Name',
  'Phone Number',
  'Full Address',
  'Order amount',
  'Payment Mode',
  'Product Name',
  'Order Confirmed',
  'Call Status',
  '4 HR',
  'Day 2',
  'Remarks',
  'Whatsapp Confirmation Sent',
  'Address Verified'
];

/**
 * Maps Call Status value to clear readable description
 */
export function mapCallStatus(status: string): string {
  switch (status) {
    case 'Confirmed':
      return 'Picked & Confirmed';
    case 'Cancelled':
      return 'Picked & Cancelled';
    case 'No Answer':
      return 'Not Picked (Ringing)';
    case 'Busy':
      return 'Busy';
    case 'Wrong Number':
      return 'Wrong/Invalid Number';
    case 'Callback Later':
      return 'Picked & Scheduled Callback';
    case 'Fake Order':
      return 'Fake Order / Third Party';
    case 'Pending':
      return 'Not Attempted';
    default:
      return status || 'Not Attempted';
  }
}

/**
 * Maps Order Confirmed value
 */
export function mapOrderConfirmed(status: string): string {
  if (status === 'Confirmed') return 'Yes';
  if (status === 'Cancelled' || status === 'Fake Order') return 'No';
  return 'Pending';
}

/**
 * Creates values array matching required columns
 */
export function formatOrderRow(order: Order, latestRemarks?: string): any[] {
  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  const addressStr = `${order.address || ''}${order.city ? ', ' + order.city : ''}${order.state ? ', ' + order.state : ''}${order.pincode ? ' - ' + order.pincode : ''}`;
  
  return [
    dateStr,
    order.id,
    order.customerName || '',
    order.phoneNumber || '',
    addressStr,
    order.codAmount || 0,
    order.paymentMode || 'COD',
    order.productName || '',
    mapOrderConfirmed(order.status),
    mapCallStatus(order.status),
    order.retry4HrStatus || 'Pending',
    order.retryDay2Status || 'Pending',
    latestRemarks || order.notes || '',
    order.whatsappStatus || 'Pending',
    order.addressVerified || 'Pending'
  ];
}

/**
 * Initializes Spreadsheet header row if needed in a given sheet
 */
export async function setupSpreadsheetHeaders(accessToken: string, spreadsheetId: string): Promise<boolean> {
  try {
    const range = 'Sheet1!A1:O1';
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:O1`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.values && data.values[0] && data.values[0].length > 0) {
        // Headers already exist, don't overwrite
        return true;
      }
    }

    // Put headers
    const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:O1?valueInputOption=USER_ENTERED`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [REQUIRED_HEADERS]
      })
    });

    return putRes.ok;
  } catch (error) {
    console.error('Error creating headers:', error);
    return false;
  }
}

/**
 * Syncs a single order to a Google Spreadsheet. Checks for duplicates and updates/appends.
 */
export async function syncOrderToSpreadsheet(accessToken: string, spreadsheetId: string, order: Order, latestRemarks?: string): Promise<boolean> {
  try {
    // 1. Ensure headers exist
    await setupSpreadsheetHeaders(accessToken, spreadsheetId);

    // 2. Fetch sheet rows to scan for the Order number in Column B
    const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:O`;
    const fetchRes = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!fetchRes.ok) {
      console.warn(`Could not fetch values, trying root fallback range for spreadsheet ${spreadsheetId}`);
      // Try backup fallback range if 'Sheet1' naming is custom
      const fallbackUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:O`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!fallbackRes.ok) return false;
    }

    const data = await fetchRes.json();
    const rows: any[][] = data.values || [];
    
    // Find row index (1-indexed for sheets) matching Order ID in column B (index 1)
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][1] === order.id) {
        rowIndex = i + 1;
        break;
      }
    }

    const rowValues = formatOrderRow(order, latestRemarks);

    if (rowIndex !== -1) {
      // Update existing row
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A${rowIndex}:O${rowIndex}?valueInputOption=USER_ENTERED`;
      const updateRes = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowValues]
        })
      });
      return updateRes.ok;
    } else {
      // Append as new row
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:O:append?valueInputOption=USER_ENTERED`;
      const appendRes = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowValues]
        })
      });
      return appendRes.ok;
    }
  } catch (err) {
    console.error(`Spreadsheet ${spreadsheetId} sync error:`, err);
    return false;
  }
}

/**
 * Bulk updates/creates all orders on a single Spreadsheet
 */
export async function forceSyncAllToSpreadsheet(accessToken: string, spreadsheetId: string, orders: Order[]): Promise<number> {
  try {
    await setupSpreadsheetHeaders(accessToken, spreadsheetId);
    let successCount = 0;
    for (const order of orders) {
      const ok = await syncOrderToSpreadsheet(accessToken, spreadsheetId, order);
      if (ok) successCount++;
    }
    return successCount;
  } catch (error) {
    console.error('All-sheets force sync error:', error);
    return 0;
  }
}
