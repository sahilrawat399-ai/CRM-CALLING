/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Order, CallLog, StatusHistory, RealtimeStats, OrderStatus } from './src/types';

const PORT = 3000;
const app = express();

app.use(express.json({ limit: '10mb' }));

// Database file path
const DB_FILE = path.join(process.cwd(), 'db.json');

// Memory-based connected SSE clients
let sseClients: { id: number; res: express.Response }[] = [];

// Helper to broadcast changes
function broadcastUpdate(type: string, data: any) {
  const message = JSON.stringify({ type, data });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${message}\n\n`);
    } catch (err) {
      console.error('Error writing to client SSE:', err);
    }
  });
}

// Initial Mock Data setup
const DEFAULT_ORDERS: Order[] = [
  {
    id: 'ord_1',
    customerName: 'Aarav Sharma',
    phoneNumber: '+91 9876543210',
    productName: 'Leopard Luxe Elite Leather Jacket (Black, L)',
    codAmount: 4299,
    address: 'H.No 104, Sector 15, Vasundhara',
    city: 'Ghaziabad',
    state: 'Uttar Pradesh',
    pincode: '201012',
    status: 'Pending',
    notes: 'Premium sheepskin. Call before dispatch. Prefers afternoon delivery.',
    callAttempts: 0,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'ord_2',
    customerName: 'Diya Patel',
    phoneNumber: '+91 8765432109',
    productName: 'Leopard Luxe Airflow-2026 Trail Sneakers',
    codAmount: 2499,
    address: 'Flat 4B, Shridhar Apartments, Satellite Rd',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380015',
    status: 'Confirmed',
    notes: 'Customer requested size 8 instead of 9.',
    callAttempts: 1,
    lastCalledAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'ord_3',
    customerName: 'Rohan Verma',
    phoneNumber: '+91 7654321098',
    productName: 'Leopard Luxe Classic Cotton Casual Polo',
    codAmount: 1199,
    address: '202, Block C, Grand Residency, Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560066',
    status: 'Cancelled',
    notes: 'Wrong size selected, wants to re-order.',
    callAttempts: 1,
    lastCalledAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'ord_4',
    customerName: 'Isha Nair',
    phoneNumber: '+91 9123456789',
    productName: 'Leopard Luxe Mulberry Silk Fest Saree',
    codAmount: 5499,
    address: 'Grace Villa, MG Road, Ernakulam',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682016',
    status: 'Callback Later',
    notes: 'Wants delivery after Monday. Busy during current call.',
    callAttempts: 1,
    lastCalledAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'ord_5',
    customerName: 'Kabir Mehta',
    phoneNumber: '+91 9345678901',
    productName: 'Leopard Luxe Pro Active Smart Sports Watch',
    codAmount: 3199,
    address: 'Shop 12, Main Market, Gole Market',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110001',
    status: 'No Answer',
    notes: 'No response. Ringing tone active.',
    callAttempts: 2,
    lastCalledAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: 'ord_6',
    customerName: 'Aditya Sen',
    phoneNumber: '+91 9224466880',
    productName: 'Leopard Luxe Urban Corduroy Trousers (Beige)',
    codAmount: 1799,
    address: 'Flat 102, Wing-A, Greenfield Society, Wakad',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411057',
    status: 'Pending',
    notes: 'High demand cords. Double check the length requested.',
    callAttempts: 0,
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'ord_7',
    customerName: 'Sanjana Roy',
    phoneNumber: '+91 9112233445',
    productName: 'Leopard Luxe Premium polarized Aviator Sunglasses',
    codAmount: 1599,
    address: '15 Main St, Salt Lake Sector V',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700091',
    notes: 'Urgent gift. Confirm package shield.',
    status: 'Pending',
    callAttempts: 0,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  }
];

const DEFAULT_CALLS: CallLog[] = [
  {
    id: 'call_1',
    orderId: 'ord_2',
    agentName: 'Alice Agent',
    phoneNumber: '+91 8765432109',
    status: 'Confirmed',
    remarks: 'Customer answered and confirmed order. Requested size size 8 instead of 9.',
    duration: 45,
    callTime: '10:15 AM',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'call_2',
    orderId: 'ord_3',
    agentName: 'Bob Agent',
    phoneNumber: '+91 7654321098',
    status: 'Cancelled',
    remarks: 'Refused confirmation. Mentioned ordering wrong item and wants to repurchase a different color.',
    duration: 35,
    callTime: '11:45 AM',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'call_3',
    orderId: 'ord_4',
    agentName: 'Alice Agent',
    phoneNumber: '+91 9123456789',
    status: 'Callback Later',
    remarks: 'Customer was driving. Requested to call back tomorrow evening after weekend shifts.',
    duration: 15,
    callTime: '01:30 PM',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'call_4',
    orderId: 'ord_5',
    agentName: 'Bob Agent',
    phoneNumber: '+91 9345678901',
    status: 'No Answer',
    remarks: 'First call attempt. Long ring, no response.',
    duration: 20,
    callTime: '02:00 PM',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
  }
];

const DEFAULT_HISTORY: StatusHistory[] = [
  {
    id: 'hist_1',
    orderId: 'ord_2',
    previousStatus: 'Pending',
    newStatus: 'Confirmed',
    changedBy: 'Alice Agent',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'hist_2',
    orderId: 'ord_3',
    previousStatus: 'Pending',
    newStatus: 'Cancelled',
    changedBy: 'Bob Agent',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'hist_3',
    orderId: 'ord_4',
    previousStatus: 'Pending',
    newStatus: 'Callback Later',
    changedBy: 'Alice Agent',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'hist_4',
    orderId: 'ord_5',
    previousStatus: 'Pending',
    newStatus: 'No Answer',
    changedBy: 'Bob Agent',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
  }
];

interface DBObj {
  orders: Order[];
  callLogs: CallLog[];
  statusHistory: StatusHistory[];
  connectedSheets?: string[];
}

// Ensure database file loaded
function loadDB(): DBObj {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (!parsed.connectedSheets) {
        parsed.connectedSheets = [];
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error loading database:', err);
  }
  
  // Return and seed default database
  const initDb: DBObj = {
    orders: DEFAULT_ORDERS,
    callLogs: DEFAULT_CALLS,
    statusHistory: DEFAULT_HISTORY,
    connectedSheets: []
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initDb, null, 2), 'utf-8');
  return initDb;
}

function saveDB(data: DBObj) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// Initialize Gemini Client
let geminiAvailable = false;
let aiClient: GoogleGenAI | null = null;

if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    geminiAvailable = true;
    console.log('Gemini API successfully initialized on Express backend.');
  } catch (error) {
    console.error('Failed to initialize GoogleGenAI client:', error);
  }
} else {
  console.log('Gemini API Secret is missing or contains default template placeholder. AI queries will fallback to custom local intelligence.');
}

// Compute Statistics Helper
function computeStats(orders: Order[]): RealtimeStats {
  const totalOrders = orders.length;
  const pendingCalls = orders.filter((o) => o.status === 'Pending').length;
  const confirmedOrders = orders.filter((o) => o.status === 'Confirmed').length;
  const cancelledOrders = orders.filter((o) => o.status === 'Cancelled').length;
  const noAnswerOrders = orders.filter((o) => o.status === 'No Answer').length;
  const callbackOrders = orders.filter((o) => o.status === 'Callback Later').length;
  
  const totalRevenue = orders
    .filter((o) => o.status === 'Confirmed')
    .reduce((acc, o) => acc + (o.codAmount || 0), 0);

  const closedCalls = orders.filter((o) => o.status !== 'Pending').length;
  const confirmationRate = closedCalls > 0 ? Math.round((confirmedOrders / closedCalls) * 100) : 0;

  return {
    totalOrders,
    pendingCalls,
    confirmedOrders,
    cancelledOrders,
    noAnswerOrders,
    callbackOrders,
    confirmationRate,
    totalRevenue,
  };
}

// Live SSE Stream for connected clients
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const clientId = Date.now();
  const client = { id: clientId, res };
  sseClients.push(client);

  // Keep connection warm
  client.res.write(`data: ${JSON.stringify({ type: 'connected', id: clientId })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// APIs Status / Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', geminiAvailable, time: new Date().toISOString() });
});

// GET statistics
app.get('/api/stats', (req, res) => {
  const db = loadDB();
  res.json(computeStats(db.orders));
});

// GET all orders
app.get('/api/orders', (req, res) => {
  const db = loadDB();
  res.json(db.orders);
});

// GET specific order summary / details
app.get('/api/orders/:id', (req, res) => {
  const db = loadDB();
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  const logs = db.callLogs.filter((l) => l.orderId === order.id);
  const history = db.statusHistory.filter((h) => h.orderId === order.id);
  res.json({ order, logs, history });
});

// POST load/upload bulk orders (excel or csv parsed on client)
app.post('/api/orders/upload', (req, res) => {
  try {
    const { orders: uploadedOrders } = req.body;
    
    if (!Array.isArray(uploadedOrders)) {
      return res.status(400).json({ error: 'Invalid payload. Standard list expected under "orders".' });
    }

    const db = loadDB();
    let duplicatesCount = 0;
    let addedCount = 0;

    uploadedOrders.forEach((o: any) => {
      // Validate phone number presence and name
      if (!o || !o.phoneNumber || !o.customerName) {
        return;
      }

      // Clean duplicate phone & product matches to prevent multiple sales listings
      const cleanedPhone = String(o.phoneNumber).trim();
      const isDuplicate = db.orders.some(
        (existing) => {
          const existingPhone = String(existing?.phoneNumber || '').trim();
          const existingProd = String(existing?.productName || '').trim().toLowerCase();
          const currentProd = String(o.productName || '').trim().toLowerCase();
          return existingPhone.replace(/\s+/g, '') === cleanedPhone.replace(/\s+/g, '') &&
                 existingProd === currentProd;
        }
      );

      if (isDuplicate) {
        duplicatesCount++;
      } else {
        const newOrder: Order = {
          id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          customerName: String(o.customerName).trim(),
          phoneNumber: cleanedPhone,
          productName: String(o.productName || 'E-commerce Product').trim(),
          codAmount: Number(o.codAmount) || 0,
          address: String(o.address || '').trim(),
          city: String(o.city || '').trim(),
          state: String(o.state || '').trim(),
          pincode: String(o.pincode || '').trim(),
          status: (o.status as OrderStatus) || 'Pending',
          notes: String(o.notes || '').trim(),
          callAttempts: 0,
          createdAt: new Date().toISOString(),
          paymentMode: String(o.paymentMode || 'COD').trim(),
          retry4HrStatus: String(o.retry4HrStatus || 'Pending').trim(),
          retryDay2Status: String(o.retryDay2Status || 'Pending').trim(),
          whatsappStatus: String(o.whatsappStatus || 'Pending').trim(),
          addressVerified: String(o.addressVerified || 'Pending').trim(),
        };
        db.orders.unshift(newOrder);
        addedCount++;
      }
    });

    saveDB(db);

    // Broadcast realtime update to sync across other user nodes
    broadcastUpdate('orders_synchronized', { total: db.orders.length, updated: true });

    res.json({
      success: true,
      added: addedCount,
      duplicatesSkipped: duplicatesCount,
      totalCount: db.orders.length,
    });
  } catch (error: any) {
    console.error('Core order upload error:', error);
    res.status(500).json({ error: 'Failed to process spreadsheet upload due to server error: ' + error.message });
  }
});

// POST to record customer call log and update status
app.post('/api/orders/:id/call-log', (req, res) => {
  const { id: orderId } = req.params;
  const { agentName, status, remarks, summary, duration, callTime } = req.body;

  const db = loadDB();
  const orderIndex = db.orders.findIndex((o) => o.id === orderId);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order profile not found' });
  }

  const order = db.orders[orderIndex];
  const originalStatus = order.status;

  // Insert Call Log
  const newLog: CallLog = {
    id: `call_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    orderId,
    agentName: agentName || 'Agent Code',
    phoneNumber: order.phoneNumber,
    status: status as OrderStatus,
    remarks: remarks || 'Call completed.',
    summary: summary || '',
    duration: Number(duration) || 0,
    callTime: callTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: new Date().toISOString(),
  };

  db.callLogs.unshift(newLog);

  // Trigger internal status transition logs
  const changesLogged: StatusHistory = {
    id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    orderId,
    previousStatus: originalStatus,
    newStatus: status,
    changedBy: agentName || 'System',
    timestamp: new Date().toISOString(),
  };
  db.statusHistory.unshift(changesLogged);

  // Update original order record
  order.status = status as OrderStatus;
  order.callAttempts += 1;
  order.lastCalledAt = new Date().toISOString();

  // Map and trigger automatic retry schedules
  const missedAttempts = ['No Answer', 'Busy', 'Wrong Number', 'Callback Later'].includes(status);
  
  if (missedAttempts) {
    if (order.callAttempts === 1) {
      order.retry4HrStatus = 'Scheduled';
      order.retry4HrTime = new Date(Date.now() + 4 * 3600 * 1000).toISOString(); // 4 hours later
    } else if (order.callAttempts === 2) {
      order.retry4HrStatus = 'No Answer';
      order.retryDay2Status = 'Scheduled';
      order.retryDay2Time = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // 2 days later
    } else if (order.callAttempts >= 3) {
      order.retryDay2Status = 'No Answer';
    }
  } else if (status === 'Confirmed') {
    order.retry4HrStatus = 'Not Needed';
    order.retryDay2Status = 'Not Needed';
    order.whatsappStatus = 'Yes';
    order.addressVerified = 'Yes';
  } else if (status === 'Cancelled' || status === 'Fake Order') {
    order.retry4HrStatus = 'Not Needed';
    order.retryDay2Status = 'Not Needed';
  }

  db.orders[orderIndex] = order;
  saveDB(db);

  // Notify active listener pipelines
  broadcastUpdate('order_updated', { orderId, status, duration });
  broadcastUpdate('call_logged', newLog);

  res.json({ success: true, order, callLog: newLog });
});

// GET all call historical remarks logs
app.get('/api/calls', (req, res) => {
  const db = loadDB();
  res.json(db.callLogs);
});

// POST AI calls summary / notes suggestions using Gemini API (server-side only)
app.post('/api/ai/summarize', async (req, res) => {
  const { customerName, productName, duration, remarks, status, transcript } = req.body;

  try {
    if (geminiAvailable && aiClient) {
      const prompt = `You are Leopard Luxe CRM's AI Call Analyst. An agent just called customer "${customerName}" regarding their COD order of "${productName}". 
      Call details:
      - Call Status: ${status}
      - Call Duration: ${duration} seconds
      - Agent's Rough Remarks: "${remarks}"
      - Available Call Transcript: "${transcript || 'No direct transcript stream recorded.'}"

      Objective: Write a highly professional, action-oriented, and concise summary of the call (maximum 30 words).
      The summary must capture:
      1. Order confirmation status (whether confirmed, cancelled, delayed, etc.)
      2. Customer concerns or details (e.g. requests for size changes, address corrections, preferred delivery slot)
      3. Specific agreed-upon actions (e.g. dispatch immediately, schedule callback, cancel active item)
      
      Format the response as a single, fluid, professional line with no introductions, bullet points, or conversational pleasantries.`;

      const geminiResponse = await aiClient.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      const summaryText = geminiResponse.text?.trim() || 'AI Summary generation completed.';
      return res.json({ summary: summaryText, method: 'gemini-api' });
    }
  } catch (error) {
    console.error('Gemini call error:', error);
  }

  // Graceful rule-based intelligent fallback when AI is busy or has no active API key
  const statusLower = String(status).toLowerCase();
  let fallbackSummary = '';
  
  if (statusLower.includes('confirm')) {
    fallbackSummary = `Confirmed COD of ${productName} (${duration}s). Customer verified; ready for delivery dispatch ${remarks ? `- Note: ${remarks}` : ''}.`;
  } else if (statusLower.includes('cancel')) {
    fallbackSummary = `Cancelled COD order of ${productName}. Reason: "${remarks || 'Wrong choice/pincode mismatch'}". Action: Stop dispatch.`;
  } else if (statusLower.includes('callback') || statusLower.includes('later')) {
    fallbackSummary = `Callback requested in ${duration}s connection. Agent scheduled call retry soon. Remarks: ${remarks || 'Busy'}.`;
  } else {
    fallbackSummary = `Logged call (${duration}s) with status "${status}". Action: ${remarks || 'Review required'}.`;
  }

  res.json({
    summary: fallbackSummary,
    method: 'algorithmic-fallback',
  });
});

// POST to evaluate agent remarks quality/accuracy (AI or algorithmic audit)
app.post('/api/admin/audit-remarks', async (req, res) => {
  const { calls: auditCalls } = req.body;
  if (!Array.isArray(auditCalls) || auditCalls.length === 0) {
    return res.json({ accuracyAverage: 0, evaluations: {} });
  }

  // Predefined algorithmic rule fallback
  interface AuditResult {
    score: number;
    evaluation: string;
  }
  const evaluations: Record<string, AuditResult> = {};
  let totalScore = 0;

  for (const c of auditCalls) {
    const text = String(c.remarks || '').trim();
    const status = String(c.status || '').toLowerCase();
    let score = 60;
    let evalMsg = 'Basic notes logged.';

    if (text.length < 10) {
      score -= 20;
      evalMsg = 'Too sparse. Lacks action context or helpful remarks.';
    } else if (text.length > 50) {
      score += 20;
      evalMsg = 'Highly detailed and precise calling notes.';
    } else if (text.length > 25) {
      score += 10;
      evalMsg = 'Good descriptive calling summary.';
    }

    if (status.includes('confirm')) {
      if (text.toLowerCase().includes('confirm') || text.toLowerCase().includes('dispatch') || text.toLowerCase().includes('yes') || text.toLowerCase().includes('deliver') || text.toLowerCase().includes('size')) {
        score += 20;
      } else {
        score -= 10;
        evalMsg += ' Status is Confirmed but lacks direct verification details.';
      }
    } else if (status.includes('cancel')) {
      if (text.toLowerCase().includes('cancel') || text.toLowerCase().includes('wrong') || text.toLowerCase().includes('no') || text.toLowerCase().includes('returned') || text.toLowerCase().includes('refused')) {
        score += 20;
      } else {
        score -= 10;
        evalMsg += ' Status is Cancelled but fails to state customer reasons.';
      }
    } else if (status.includes('later') || status.includes('callback') || status.includes('busy')) {
      if (text.toLowerCase().includes('call') || text.toLowerCase().includes('time') || text.toLowerCase().includes('later') || text.toLowerCase().includes('tomorrow') || text.toLowerCase().includes('busy') || text.toLowerCase().includes('schedule')) {
        score += 20;
      } else {
        score -= 10;
        evalMsg += ' Rescheduling required but notes lack timestamp details.';
      }
    }

    score = Math.max(30, Math.min(100, score));
    evaluations[c.id] = { score, evaluation: evalMsg };
    totalScore += score;
  }

  const algorithmicAverage = Math.round(totalScore / auditCalls.length);

  try {
    if (geminiAvailable && aiClient) {
      const callsRep = auditCalls.map((c) => `ID: ${c.id}, Status: ${c.status}, Remarks: "${c.remarks}"`).join('\n');
      const prompt = `You are Leopard Luxe CRM's AI Call Quality Auditor. Below are customer call records from an e-commerce confirmation center.
Analyze each agent's remarks against the logged status for completeness, accuracy, and professional rigor, and output a JSON response.

Call Records:
${callsRep}

Guidelines:
1. Score each record from 30 to 100 based on detail level:
   - Does it detail confirmation aspects? (e.g., verifying dispatch, address, specific size modification requested for confirmed statuses).
   - If cancelled, does it state precise user reservation/concerns?
   - Is it professional and actionable?
2. Return a JSON object containing:
   - "accuracyAverage": number (the overall average score)
   - "evaluations": an object mapping each call ID to { "score": number, "evaluation": "short 1-sentence evaluation statement" }

Ensure raw, valid JSON only. Keep descriptions professional and short.`;

      const geminiResponse = await aiClient.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = geminiResponse.text?.trim();
      if (responseText) {
        const parsed = JSON.parse(responseText);
        return res.json({
          accuracyAverage: parsed.accuracyAverage || algorithmicAverage,
          evaluations: parsed.evaluations || evaluations,
          method: 'gemini-api'
        });
      }
    }
  } catch (error) {
    console.error('Gemini audit evaluation failed:', error);
  }

  res.json({
    accuracyAverage: algorithmicAverage,
    evaluations,
    method: 'algorithmic-fallback'
  });
});

// POST AI Speech Recognition / Remark Suggestion (voice simulation tool)
app.post('/api/ai/speech-to-text', async (req, res) => {
  const { voiceDataSample } = req.body;
  const simulatedTranscripts = [
    'Customer confirmed the delivery for Saturday morning and requested a call-back beforehand.',
    'Customer is complaining about the custom coupon code not being applied, cancel active SKU.',
    'Customer asked if we have this in olive green rather than beige cords. Place callback soon.',
    'Customer confirmed! Please dispatch immediately as they have travel plans next week.'
  ];
  const randomTranscript = simulatedTranscripts[Math.floor(Math.random() * simulatedTranscripts.length)];
  res.json({ text: randomTranscript });
});

// POST to update meta fields of an order
app.post('/api/orders/:id/update-fields', (req, res) => {
  const { id: orderId } = req.params;
  const { whatsappStatus, addressVerified, paymentMode, retry4HrStatus, retryDay2Status } = req.body;

  const db = loadDB();
  const orderIndex = db.orders.findIndex((o) => o.id === orderId);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = db.orders[orderIndex];
  if (whatsappStatus !== undefined) order.whatsappStatus = whatsappStatus;
  if (addressVerified !== undefined) order.addressVerified = addressVerified;
  if (paymentMode !== undefined) order.paymentMode = paymentMode;
  if (retry4HrStatus !== undefined) order.retry4HrStatus = retry4HrStatus;
  if (retryDay2Status !== undefined) order.retryDay2Status = retryDay2Status;

  db.orders[orderIndex] = order;
  saveDB(db);

  broadcastUpdate('order_updated', { orderId, status: order.status });
  res.json({ success: true, order });
});

// GET Settings (including Google Spreadsheet Live IDs)
app.get('/api/admin/settings', (req, res) => {
  const db = loadDB();
  res.json({ connectedSheets: db.connectedSheets || [] });
});

// POST Settings
app.post('/api/admin/settings', (req, res) => {
  const { connectedSheets } = req.body;
  
  if (!Array.isArray(connectedSheets)) {
    return res.status(400).json({ error: 'Invalid config. "connectedSheets" must be an array.' });
  }

  const db = loadDB();
  db.connectedSheets = connectedSheets;
  saveDB(db);

  res.json({ success: true, connectedSheets });
});

// Admin panel actions: Export / Reset CRM logs
app.post('/api/admin/reset-data', (req, res) => {
  const initDb: DBObj = {
    orders: DEFAULT_ORDERS,
    callLogs: DEFAULT_CALLS,
    statusHistory: DEFAULT_HISTORY
  };
  saveDB(initDb);
  broadcastUpdate('orders_synchronized', { total: initDb.orders.length, updated: true });
  res.json({ success: true, message: 'CRM Database re-seeded to default profiles!' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Leopard Luxe CRM server bootstrapped running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
