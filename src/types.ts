/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus =
  | 'Pending'
  | 'Picked'
  | 'Not Picked'
  | 'Busy'
  | 'Switched Off'
  | 'Invalid Number'
  | 'Order Confirmed'
  | 'Order Cancelled'
  | 'Callback Later'
  | 'Interested'
  | 'Fake Order'
  | 'Confirmed'
  | 'Cancelled'
  | 'No Answer'
  | 'Wrong Number';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  status: 'online' | 'offline' | 'busy';
  lastActive: string;
}

export interface Order {
  id: string;
  customerName: string;
  phoneNumber: string;
  productName: string;
  codAmount: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: OrderStatus;
  notes?: string;
  assignedAgentId?: string;
  callAttempts: number;
  lastCalledAt?: string;
  createdAt: string;

  // New Excel sheet & retry tracking fields
  orderDate?: string;
  orderNumber?: string;
  paymentMode?: string;
  orderConfirmed?: string; // Yes/No/''
  callStatus?: string; // Picked, Not Picked, Busy, Switched Off, Invalid Number, Order Confirmed, Order Cancelled
  retry4Hr?: string; // Status of 1st retry (3-8 hrs)
  retryDay2?: string; // Status of 2nd retry (1 day)
  remarks?: string;
  whatsappConfirmationSent?: 'Yes' | 'No' | 'Pending';
  addressVerified?: 'Yes' | 'No' | 'Pending';
}

export interface CallLog {
  id: string;
  orderId: string;
  agentName: string;
  phoneNumber: string;
  status: OrderStatus;
  remarks: string;
  summary?: string; // AI generated summary
  duration: number; // in seconds
  callTime: string; // formatted time e.g., "10:30 AM"
  timestamp: string; // ISO string
}

export interface StatusHistory {
  id: string;
  orderId: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  timestamp: string;
}

export interface RealtimeStats {
  totalOrders: number;
  pendingCalls: number;
  confirmedOrders: number;
  cancelledOrders: number;
  noAnswerOrders: number;
  callbackOrders: number;
  confirmationRate: number;
  totalRevenue: number;
}
