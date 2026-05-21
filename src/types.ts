/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Cancelled'
  | 'No Answer'
  | 'Callback Later'
  | 'Busy'
  | 'Wrong Number'
  | 'Interested'
  | 'Fake Order';

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
}

export interface CallLog {
  id: string;
  orderId: string;
  agentName: string;
  phoneNumber: string;
  status: OrderStatus;
  remarks: string;
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
