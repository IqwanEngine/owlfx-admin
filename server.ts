/* Powered by IqwanEngine */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const MY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxPr5ErC0hvMnxmM477ekAmFis9RAp44OtP55g2eKPsUdc7_bltM5G7ooSS0AFnmvUC/exec?action=fetch';
const ID_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxK0G2aOhYNy5WalUQjImp4aReiTGfgEEKBR61Q7Lunjm_zCybglbpPU1iVL5J8r--z/exec?action=fetch';

const DEFAULT_ALLOWED_EMAILS = 'hairuliqwan352@gmail.com,admin@owlfx.my,iqwan@owlfx.my,boyintraderz@gmail.com';

// In-memory cache & fallback retention for high-performance low-latency response
interface CachePayload {
  data: any;
  timestamp: number;
}
let cachedTraders: CachePayload | null = null;
const CACHE_TTL_MS = 25000; // 25 seconds cache TTL for low-latency live polling

// Retain last known successful data per country so temporary GAS network blips never wipe out data
let lastKnownMY: any[] = [];
let lastKnownID: any[] = [];

async function fetchFromEndpointWithRetry(url: string, country: 'MY' | 'ID', retries = 2): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40000);

      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'OwlAlgo-IqwanEngine/2.0'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }

      const text = await response.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.warn(`[IqwanEngine] Non-JSON response from ${country} endpoint:`, text.substring(0, 100));
        throw new Error('Invalid JSON received from upstream Google Apps Script');
      }

      let records: any[] = [];
      if (json && Array.isArray(json.data)) {
        records = json.data;
      } else if (Array.isArray(json)) {
        records = json;
      } else if (json && Array.isArray(json.results)) {
        records = json.results;
      } else if (json && Array.isArray(json.records)) {
        records = json.records;
      }

      if (records && records.length > 0) {
        if (country === 'MY') lastKnownMY = records;
        if (country === 'ID') lastKnownID = records;
        return records;
      }

      // If empty array returned but we have fallback
      if (records.length === 0 && (country === 'MY' ? lastKnownMY : lastKnownID).length > 0) {
        return country === 'MY' ? lastKnownMY : lastKnownID;
      }

      return records;
    } catch (error: any) {
      console.warn(`[IqwanEngine] Fetch attempt ${attempt + 1}/${retries + 1} for ${country} failed:`, error.message);
      if (attempt < retries) {
        // Wait 800ms before retry
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }

  // Graceful fallback to retained data
  const fallback = country === 'MY' ? lastKnownMY : lastKnownID;
  if (fallback && fallback.length > 0) {
    return fallback;
  }

  return [];
}

/**
 * Smart regional phone sanitization supporting Malaysian (+60) and Indonesian (+62) numbers.
 */
function sanitizePhone_(rawPhone: any, region: 'MY' | 'ID' = 'MY'): string {
  if (!rawPhone || String(rawPhone).trim() === '' || String(rawPhone).trim() === '-') {
    return '-';
  }

  // 1.1 Character Stripping: Remove all non-digit characters except the leading plus sign
  let cleaned = String(rawPhone).trim();
  const hasLeadingPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
  } else if (hasLeadingPlus) {
    cleaned = '+' + cleaned.replace(/\+/g, '');
  }

  if (!cleaned || cleaned === '+') {
    return '-';
  }

  // 1.2 Explicit International Formats
  if (cleaned.startsWith('+60') || cleaned.startsWith('+62')) {
    return cleaned;
  }
  if (cleaned.startsWith('60') && cleaned.length >= 9) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('62') && cleaned.length >= 9) {
    return '+' + cleaned;
  }

  // 1.3 Local Zero Prefix Smart Routing
  if (cleaned.startsWith('08')) {
    return '+62' + cleaned.substring(1);
  }
  if (cleaned.startsWith('01')) {
    return '+60' + cleaned.substring(1);
  }
  if (cleaned.startsWith('0')) {
    const prefix = region === 'ID' ? '+62' : '+60';
    return prefix + cleaned.substring(1);
  }

  const defaultPrefix = region === 'ID' ? '+62' : '+60';
  return defaultPrefix + cleaned;
}

/**
 * Clean and safely parse balance, equity, credit, and margin values from raw inputs.
 * Strips thousand-separator commas, currency symbols, and handles Cent / N/A values.
 */
function sanitizeBalance(raw: any, accountType: string = '', currency: string = ''): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') {
    return isNaN(raw) ? 0 : raw;
  }
  const str = String(raw).trim();
  if (str === '' || str === '-' || /n\/?a/i.test(str)) return 0;

  // Remove thousand commas and any non-numeric characters except minus and period
  const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;

  return num;
}

function normalizeRawRecord(raw: any, country: 'MY' | 'ID', index: number) {
  const rowIdx = raw.row_index ?? index + 1;
  const traderName = String(raw.trader_name || 'UNKNOWN TRADER').trim().toUpperCase();
  const contactNumber = sanitizePhone_(raw.contact_number, country);
  const registerEmail = String(raw.register_email || '').trim().toLowerCase();
  const tradingViewUsername = String(raw.trading_view_username || '-').trim();
  const valetaxId = String(raw.valetax_id || '-').trim();
  const registerDate = raw.register_date ? String(raw.register_date) : '';
  const serviceDays = String(raw.service_days ?? '-');
  const updatedBy = String(raw.updated_by || 'System Form');
  const level = Number(raw.level) || 1;
  const directPartnerEmail = String(raw.direct_partner_email || '-').trim();
  const accountType = String(raw.account_type || '-');
  const currency = String(raw.currency || 'USD').toUpperCase();

  const balance = sanitizeBalance(raw.balance, accountType, currency);
  const equity = sanitizeBalance(raw.equity, accountType, currency);
  const credit = sanitizeBalance(raw.credit, accountType, currency);
  const margin = sanitizeBalance(raw.margin, accountType, currency);
  const leverage = Number(String(raw.leverage ?? 100).replace(/[^0-9.]/g, '')) || 100;
  const accountName = String(raw.account_name || '-');
  const server = String(raw.server || '-');
  const platform = String(raw.platform || 'meta4');
  const dateOfCreation = raw.date_of_creation ? String(raw.date_of_creation) : '';
  const status = String(raw.status || 'Active').trim();

  let registerDateFormatted = '-';
  if (registerDate) {
    try {
      const d = new Date(registerDate);
      if (!isNaN(d.getTime())) {
        registerDateFormatted = d.toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kuala_Lumpur'
        });
      } else {
        registerDateFormatted = registerDate;
      }
    } catch {
      registerDateFormatted = registerDate;
    }
  }

  // 1. FIX "LAST UPDATED" DATA MAPPING (COLUMN W / COLUMN 23 INTEGRATION)
  // Read review timestamp directly from Column W (Column 23 - "Updated TIME")
  // If Column W contains a timestamp, format as "YYYY-MM-DD HH:mm:ss" in GMT+8
  // If unreviewed, Column W is "-", and MUST display "-" (no fallback to creation date or registration date!)
  let lastUpdateFormatted = '-';
  const rawUpdatedTime = raw.updated_time ?? raw.last_update ?? raw.updated_time_col_w ?? raw.review_time ?? raw.last_updated ?? raw.col_w;

  if (rawUpdatedTime && String(rawUpdatedTime).trim() !== '' && String(rawUpdatedTime).trim() !== '-' && String(rawUpdatedTime).trim() !== 'undefined' && String(rawUpdatedTime).trim() !== 'null') {
    const timeStr = String(rawUpdatedTime).trim();
    try {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        // Format in GMT+8 / Asia/Kuala_Lumpur as YYYY-MM-DD HH:mm:ss
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kuala_Lumpur',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(d);
        const map: Record<string, string> = {};
        for (const p of parts) map[p.type] = p.value;
        lastUpdateFormatted = `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
      } else {
        lastUpdateFormatted = timeStr;
      }
    } catch {
      lastUpdateFormatted = timeStr;
    }
  }

  return {
    id: `${country}-${rowIdx}-${valetaxId || Math.random().toString(36).substring(2, 7)}`,
    rowIndex: rowIdx,
    traderName,
    contactNumber,
    registerEmail,
    tradingViewUsername,
    valetaxId,
    registerDate,
    serviceDays,
    updatedBy,
    level,
    directPartnerEmail,
    balance,
    equity,
    credit,
    margin,
    leverage,
    accountName,
    accountType,
    server,
    platform,
    dateOfCreation,
    currency,
    status,
    country,
    lastUpdateFormatted,
    registerDateFormatted,
    raw
  };
}

function calculateCountryMetrics(traders: any[], country: 'MY' | 'ID') {
  const statusCounts = {
    active: 0,
    lowBal: 0,
    mc: 0,
    notValid: 0,
    validVip: 0,
    validVipIndicator: 0,
    other: 0,
    total: traders.length
  };

  const totalBalanceUSD = traders.reduce((acc, trader) => {
    let rawStr = (trader.balance || "").toString().replace(/,/g, '').trim();
    let num = parseFloat(rawStr) || 0;

    const accType = (trader.accountType || trader.account_type || "").toLowerCase();
    const curr = (trader.currency || "").toUpperCase();

    // Convert Cent (USC) to USD Base (divide by 100)
    if (accType.includes("cent") || curr === "USC") {
      num = num / 100.0;
    }
    // Convert Indonesian Rupiah (IDR) to USD Base if applicable
    else if (curr === "IDR") {
      num = num / 15500.0;
    }

    return acc + num;
  }, 0);

  for (const t of traders) {
    const normalizedStatus = (t.status || '').trim().toUpperCase();

    if (normalizedStatus === 'VALID VIP INDICATOR' || normalizedStatus.includes('VIP INDICATOR')) {
      statusCounts.validVipIndicator++;
    } else if (normalizedStatus === 'VALID VIP' || normalizedStatus.includes('VIP')) {
      statusCounts.validVip++;
    } else if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'VALID') {
      statusCounts.active++;
    } else if (
      normalizedStatus === 'LOW BAL' ||
      normalizedStatus === 'LOW BALANCE' ||
      normalizedStatus.includes('LOW')
    ) {
      statusCounts.lowBal++;
    } else if (normalizedStatus === 'MC' || normalizedStatus.includes('MARGIN CALL')) {
      statusCounts.mc++;
    } else if (
      normalizedStatus === 'NOT VALID' ||
      normalizedStatus === 'INVALID' ||
      normalizedStatus.includes('NOT')
    ) {
      statusCounts.notValid++;
    } else {
      statusCounts.other++;
    }
  }

  return {
    country,
    countryName: country === 'MY' ? 'Malaysia' : 'Indonesia',
    totalTraders: traders.length,
    totalBalanceUSD,
    statusBreakdown: statusCounts
  };
}

async function generateTradersPayload(): Promise<any> {
  let rawMY: any[] = [];
  let rawID: any[] = [];

  try {
    const results = await Promise.allSettled([
      fetchFromEndpointWithRetry(MY_ENDPOINT, 'MY'),
      fetchFromEndpointWithRetry(ID_ENDPOINT, 'ID')
    ]);

    if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
      rawMY = results[0].value;
    } else {
      rawMY = lastKnownMY;
    }

    if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) {
      rawID = results[1].value;
    } else {
      rawID = lastKnownID;
    }
  } catch (err: any) {
    console.warn('[IqwanEngine] Upstream Promise.allSettled warning:', err.message);
    rawMY = lastKnownMY;
    rawID = lastKnownID;
  }

  // Normalize & Sort descending by registration date (latest on top)
  const sortFn = (a: any, b: any) => {
    const timeA = a.registerDate ? new Date(a.registerDate).getTime() : 0;
    const timeB = b.registerDate ? new Date(b.registerDate).getTime() : 0;
    if (timeA && timeB && !isNaN(timeA) && !isNaN(timeB)) {
      return timeB - timeA;
    }
    return (b.rowIndex || 0) - (a.rowIndex || 0);
  };

  const myTraders = (rawMY || []).map((r, i) => normalizeRawRecord(r, 'MY', i)).filter(Boolean).sort(sortFn);
  const idTraders = (rawID || []).map((r, i) => normalizeRawRecord(r, 'ID', i)).filter(Boolean).sort(sortFn);

  // Determine latest registration date across all data
  let latestRegistrationDate: string | null = null;
  const allRegisteredDates = [...myTraders, ...idTraders]
    .map(t => t.registerDate)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (allRegisteredDates.length > 0) {
    latestRegistrationDate = allRegisteredDates[0].toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kuala_Lumpur'
    }) + ' (MYT)';
  }

  const myMetrics = calculateCountryMetrics(myTraders, 'MY');
  const idMetrics = calculateCountryMetrics(idTraders, 'ID');

  const lastUpdateByEngine = new Date().toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kuala_Lumpur'
  }) + ' (MYT)';

  return {
    success: true,
    timestamp: new Date().toISOString(),
    latestRegistrationDate,
    lastUpdateByEngine,
    data: {
      malaysia: myTraders,
      indonesia: idTraders
    },
    metrics: {
      malaysia: myMetrics,
      indonesia: idMetrics,
      combined: {
        totalTraders: myTraders.length + idTraders.length,
        totalBalanceUSD: myMetrics.totalBalanceUSD + idMetrics.totalBalanceUSD
      }
    }
  };
}

let inFlightPromise: Promise<any> | null = null;

async function getOrFetchTradersPayload(forceRefresh = false): Promise<any> {
  const now = Date.now();
  // Return cached payload immediately if fresh
  if (!forceRefresh && cachedTraders && (now - cachedTraders.timestamp < CACHE_TTL_MS)) {
    return cachedTraders.data;
  }

  // If stale but cached payload exists, return cached and refresh asynchronously in background
  if (!forceRefresh && cachedTraders) {
    if (!inFlightPromise) {
      inFlightPromise = generateTradersPayload().then(payload => {
        cachedTraders = { data: payload, timestamp: Date.now() };
        return payload;
      }).catch(err => {
        console.warn('[IqwanEngine] Background sync notice:', err.message);
        return cachedTraders?.data;
      }).finally(() => {
        inFlightPromise = null;
      });
    }
    return cachedTraders.data;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const payload = await generateTradersPayload();
      cachedTraders = {
        data: payload,
        timestamp: Date.now()
      };
      return payload;
    } catch (err: any) {
      console.warn('[IqwanEngine] Primary payload generation notice:', err.message);
      if (cachedTraders) {
        return cachedTraders.data;
      }
      // If absolutely no cache yet, return safe empty structure
      const emptyPayload = {
        success: true,
        isStale: true,
        timestamp: new Date().toISOString(),
        latestRegistrationDate: null,
        lastUpdateByEngine: new Date().toISOString(),
        data: { malaysia: [], indonesia: [] },
        metrics: {
          malaysia: calculateCountryMetrics([], 'MY'),
          indonesia: calculateCountryMetrics([], 'ID'),
          combined: { totalTraders: 0, totalBalanceUSD: 0 }
        }
      };
      cachedTraders = { data: emptyPayload, timestamp: Date.now() };
      return emptyPayload;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

// 1. Backend Proxy Route for Traders API
app.get('/api/traders', async (req, res) => {
  const forceRefresh = req.query.fresh === 'true';

  try {
    const payload = await getOrFetchTradersPayload(forceRefresh);
    res.json(payload);
  } catch (error: any) {
    console.error('[IqwanEngine] Unexpected /api/traders handler exception:', error);
    if (cachedTraders) {
      return res.json({
        ...cachedTraders.data,
        isStale: true,
        warning: 'Serving cached snapshot.'
      });
    }
    res.json({
      success: true,
      isStale: true,
      timestamp: new Date().toISOString(),
      latestRegistrationDate: null,
      lastUpdateByEngine: new Date().toISOString(),
      data: {
        malaysia: lastKnownMY.map((r, i) => normalizeRawRecord(r, 'MY', i)).filter(Boolean),
        indonesia: lastKnownID.map((r, i) => normalizeRawRecord(r, 'ID', i)).filter(Boolean)
      },
      metrics: {
        malaysia: calculateCountryMetrics(lastKnownMY, 'MY'),
        indonesia: calculateCountryMetrics(lastKnownID, 'ID'),
        combined: {
          totalTraders: lastKnownMY.length + lastKnownID.length,
          totalBalanceUSD: 0
        }
      }
    });
  }
});

// 2. Dual Action Endpoints: [ TICK / VERIFY ] and [ DELETE ]

// A. Verify / Mark as Checked (Update Column W in Google Sheets)
app.post('/api/traders/verify', async (req, res) => {
  try {
    const { country, rowIndex, valetaxId, timestamp } = req.body || {};
    const targetCountry: 'MY' | 'ID' = country === 'ID' ? 'ID' : 'MY';
    const targetRowIndex = Number(rowIndex);

    if (!targetRowIndex || isNaN(targetRowIndex)) {
      return res.status(400).json({ success: false, error: 'Valid rowIndex is required' });
    }

    // Format GMT+8 timestamp as YYYY-MM-DD HH:mm:ss
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    const gmt8Time = `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
    const finalTimestamp = timestamp || gmt8Time;

    const endpoint = targetCountry === 'MY' ? MY_ENDPOINT : ID_ENDPOINT;
    const cleanBaseUrl = endpoint.split('?')[0];

    // Forward to Google Apps Script
    try {
      const updateUrl = `${cleanBaseUrl}?action=updateReviewTime&rowIndex=${targetRowIndex}&timestamp=${encodeURIComponent(finalTimestamp)}`;
      fetch(updateUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'OwlAlgo-IqwanEngine/2.0' }
      }).catch(err => {
        console.warn(`[IqwanEngine] Remote GAS review update notice (${targetCountry}):`, err.message);
      });
    } catch (gasErr: any) {
      console.warn('[IqwanEngine] GAS forward dispatch error:', gasErr.message);
    }

    // Optimistically update in-memory cache
    if (cachedTraders && cachedTraders.data) {
      const key = targetCountry === 'MY' ? 'malaysia' : 'indonesia';
      const list = cachedTraders.data[key];
      if (Array.isArray(list)) {
        const item = list.find((t: any) => t.rowIndex === targetRowIndex || (valetaxId && String(t.valetaxId) === String(valetaxId)));
        if (item) {
          item.lastUpdateFormatted = finalTimestamp;
          if (item.raw) item.raw.updated_time = finalTimestamp;
        }
      }
    }

    // Also update in lastKnown retained lists
    const rawList = targetCountry === 'MY' ? lastKnownMY : lastKnownID;
    const rawItem = rawList.find((r: any) => (r.row_index === targetRowIndex) || (valetaxId && String(r.valetax_id) === String(valetaxId)));
    if (rawItem) {
      rawItem.updated_time = finalTimestamp;
      rawItem.last_update = finalTimestamp;
    }

    res.json({
      success: true,
      updatedTime: finalTimestamp,
      rowIndex: targetRowIndex,
      country: targetCountry,
      message: `Trader Row #${targetRowIndex} verified successfully at ${finalTimestamp} (GMT+8)`
    });
  } catch (error: any) {
    console.error('[IqwanEngine] Error in /api/traders/verify:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// B. Delete Trader Record (Delete row from Google Sheets)
app.post('/api/traders/delete', async (req, res) => {
  try {
    const { country, rowIndex, valetaxId } = req.body || {};
    const targetCountry: 'MY' | 'ID' = country === 'ID' ? 'ID' : 'MY';
    const targetRowIndex = Number(rowIndex);

    if (!targetRowIndex || isNaN(targetRowIndex)) {
      return res.status(400).json({ success: false, error: 'Valid rowIndex is required' });
    }

    const endpoint = targetCountry === 'MY' ? MY_ENDPOINT : ID_ENDPOINT;
    const cleanBaseUrl = endpoint.split('?')[0];

    // Forward deletion to Google Apps Script
    try {
      const deleteUrl = `${cleanBaseUrl}?action=deleteVIPRecord&rowIndex=${targetRowIndex}`;
      fetch(deleteUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'OwlAlgo-IqwanEngine/2.0' }
      }).catch(err => {
        console.warn(`[IqwanEngine] Remote GAS delete notice (${targetCountry}):`, err.message);
      });
    } catch (gasErr: any) {
      console.warn('[IqwanEngine] GAS delete forward dispatch error:', gasErr.message);
    }

    // Optimistically remove from in-memory cache
    if (cachedTraders && cachedTraders.data) {
      const key = targetCountry === 'MY' ? 'malaysia' : 'indonesia';
      if (Array.isArray(cachedTraders.data[key])) {
        cachedTraders.data[key] = cachedTraders.data[key].filter(
          (t: any) => t.rowIndex !== targetRowIndex && (!valetaxId || String(t.valetaxId) !== String(valetaxId))
        );
      }
      // Recalculate metrics
      const myMetrics = calculateCountryMetrics(cachedTraders.data.malaysia, 'MY');
      const idMetrics = calculateCountryMetrics(cachedTraders.data.indonesia, 'ID');
      cachedTraders.data.metrics = {
        malaysia: myMetrics,
        indonesia: idMetrics,
        combined: {
          totalTraders: cachedTraders.data.malaysia.length + cachedTraders.data.indonesia.length,
          totalBalanceUSD: myMetrics.totalBalanceUSD + idMetrics.totalBalanceUSD
        }
      };
    }

    // Also remove from lastKnown lists
    if (targetCountry === 'MY') {
      lastKnownMY = lastKnownMY.filter((r: any) => r.row_index !== targetRowIndex && (!valetaxId || String(r.valetax_id) !== String(valetaxId)));
    } else {
      lastKnownID = lastKnownID.filter((r: any) => r.row_index !== targetRowIndex && (!valetaxId || String(r.valetax_id) !== String(valetaxId)));
    }

    res.json({
      success: true,
      rowIndex: targetRowIndex,
      country: targetCountry,
      message: `Trader Row #${targetRowIndex} deleted successfully from ${targetCountry} database`
    });
  } catch (error: any) {
    console.error('[IqwanEngine] Error in /api/traders/delete:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Authentication & Whitelist Verification Endpoints
app.get('/api/auth/whitelist', (req, res) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  const rawList = process.env.ALLOWED_EMAILS || DEFAULT_ALLOWED_EMAILS;
  const allowed = rawList.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  const isWhitelisted = allowed.includes(email);
  res.json({
    email,
    isWhitelisted,
    allowedCount: allowed.length
  });
});

app.post('/api/auth/session', (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = (email || '').trim().toLowerCase();
  const rawList = process.env.ALLOWED_EMAILS || DEFAULT_ALLOWED_EMAILS;
  const allowed = rawList.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  if (!normalizedEmail) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  const isAuthorized = allowed.includes(normalizedEmail);
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      error: 'Unauthorized Email',
      message: 'Access Denied: Your email is not whitelisted in ALLOWED_EMAILS.',
      email: normalizedEmail
    });
  }

  res.json({
    success: true,
    user: {
      email: normalizedEmail,
      name: normalizedEmail.split('@')[0].toUpperCase(),
      isAuthorized: true,
      role: 'Secured Administrator'
    }
  });
});

// 3. Mount Vite / Static Files Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
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
    console.log(`[IqwanEngine] OWL ALGO DATABASE Server running on http://0.0.0.0:${PORT}`);
    // Initial cache warm-up asynchronously so first user requests are near-instant
    getOrFetchTradersPayload().catch(() => {});
    // Periodic background sync every 30 seconds
    setInterval(() => {
      getOrFetchTradersPayload(true).catch(() => {});
    }, 30000);
  });
}

startServer();
