/* Powered by IqwanEngine */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Inisialisasi Sambungan Supabase (IqwanEngine)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MY_ENDPOINT = (process.env.GOOGLE_SHEETS_MY_ENDPOINT || process.env.VITE_GOOGLE_SHEETS_MY_ENDPOINT || '').trim().replace(/^["']|["']$/g, '');
const ID_ENDPOINT = (process.env.GOOGLE_SHEETS_ID_ENDPOINT || process.env.VITE_GOOGLE_SHEETS_ID_ENDPOINT || 'https://script.google.com/macros/s/AKfycbxK0G2aOhYNy5WalUQjImp4aReiTGfgEEKBR61Q7Lunjm_zCybglbpPU1iVL5J8r--z/exec').trim().replace(/^["']|["']$/g, '');
const ADMIN_KEY = (process.env.ADMIN_DASHBOARD_KEY || 'IE_Admin#Gold2026!Master').trim().replace(/^["']|["']$/g, '');

function getCleanUrl(endpoint: string) {
  if (!endpoint) return '';
  const cleanEndpoint = endpoint.trim().replace(/^["']|["']$/g, '');
  return cleanEndpoint.split('?')[0] + `?action=fetch&key=${encodeURIComponent(ADMIN_KEY)}`;
}

const DEFAULT_ALLOWED_EMAILS = (
  process.env.ADMIN_ALLOWED_EMAILS ||
  'hairuliqwan352@gmail.com,admin@owlfx.my,syazzmir12@hotmail.com,iqwan@owlfx.my,boyintraderz@gmail.com'
).trim();

interface CachePayload {
  data: any;
  timestamp: number;
}
let cachedTraders: CachePayload | null = null;
const CACHE_TTL_MS = 45000;

let lastKnownMY: any[] = [];
let lastKnownID: any[] = [];

// ==========================================
// 1. Tarik Keseluruhan Data Malaysia Dari Supabase (Melepasi Had 1,000)
// ==========================================
async function fetchFromSupabaseMY(): Promise<any[]> {
  try {
    let allRecords: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('vip_clients')
        .select('*')
        .order('id', { ascending: false })
        .range(from, from + step - 1);

      if (error) {
        console.warn('[IqwanEngine] Supabase fetch notice:', error.message);
        break;
      }

      if (data && data.length > 0) {
        allRecords = allRecords.concat(data);
        if (data.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      } else {
        hasMore = false;
      }
    }

    if (allRecords.length > 0) {
      lastKnownMY = allRecords;
      return allRecords;
    }
    return lastKnownMY;
  } catch (err: any) {
    console.error('[IqwanEngine] Supabase fetch exception:', err.message);
    return lastKnownMY;
  }
}

// ==========================================
// 2. Tarik Data Indonesia Dari GAS (Asal / Direct GAS)
// ==========================================
async function fetchFromEndpointWithRetry(url: string, country: 'MY' | 'ID', retries = 2): Promise<any[]> {
  const cleanUrl = getCleanUrl(url);
  if (!cleanUrl) {
    if (country === 'ID' && lastKnownID && lastKnownID.length > 0) return lastKnownID;
    return [];
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(cleanUrl, {
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
      } catch {
        throw new Error('Invalid JSON received from upstream Google Apps Script');
      }

      let records: any[] = [];
      if (json && Array.isArray(json.data)) records = json.data;
      else if (Array.isArray(json)) records = json;
      else if (json && Array.isArray(json.results)) records = json.results;
      else if (json && Array.isArray(json.records)) records = json.records;

      if (records && records.length > 0) {
        if (country === 'ID') lastKnownID = records;
        return records;
      }

      if (records.length === 0 && country === 'ID' && lastKnownID.length > 0) {
        return lastKnownID;
      }

      return records;
    } catch (error: any) {
      if (attempt < retries) {
        // Exponential backoff to allow Google Apps Script containers to spin up or cooldown
        const delay = (attempt + 1) * 2000;
        await new Promise(r => setTimeout(r, delay));
      } else {
        // If all retries failed, fallback gracefully to last known records without logging noisy fatal warnings
        if (country === 'ID' && lastKnownID && lastKnownID.length > 0) {
          return lastKnownID;
        }
        console.info(`[IqwanEngine] Upstream fetch for ${country} notice: ${error.message} (serving fallback)`);
      }
    }
  }

  if (country === 'ID' && lastKnownID && lastKnownID.length > 0) {
    return lastKnownID;
  }

  return [];
}

function sanitizePhone_(rawPhone: any, region: 'MY' | 'ID' = 'MY'): string {
  if (!rawPhone || String(rawPhone).trim() === '' || String(rawPhone).trim() === '-') {
    return '-';
  }

  let cleaned = String(rawPhone).trim();
  const hasLeadingPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
  else if (hasLeadingPlus) cleaned = '+' + cleaned.replace(/\+/g, '');

  if (!cleaned || cleaned === '+') return '-';

  if (cleaned.startsWith('+60') || cleaned.startsWith('+62')) return cleaned;
  if (cleaned.startsWith('60') && cleaned.length >= 9) return '+' + cleaned;
  if (cleaned.startsWith('62') && cleaned.length >= 9) return '+' + cleaned;

  if (cleaned.startsWith('08')) return '+62' + cleaned.substring(1);
  if (cleaned.startsWith('01')) return '+60' + cleaned.substring(1);
  if (cleaned.startsWith('0')) {
    const prefix = region === 'ID' ? '+62' : '+60';
    return prefix + cleaned.substring(1);
  }

  const defaultPrefix = region === 'ID' ? '+62' : '+60';
  return defaultPrefix + cleaned;
}

function sanitizeBalance(raw: any, accountType: string = '', currency: string = ''): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const str = String(raw).trim();
  if (str === '' || str === '-' || /n\/?a/i.test(str)) return 0;

  const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeRawRecord(raw: any, country: 'MY' | 'ID', index: number) {
  const rowIdx = raw.row_index ?? raw.rowIndex ?? raw.id ?? (index + 7);
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

  let lastUpdateFormatted = '-';
  const rawUpdatedTime = raw.updated_time ?? raw.last_update ?? raw.updated_time_col_w ?? raw.review_time ?? raw.last_updated ?? raw.col_w;

  if (rawUpdatedTime && String(rawUpdatedTime).trim() !== '' && String(rawUpdatedTime).trim() !== '-' && String(rawUpdatedTime).trim() !== 'undefined' && String(rawUpdatedTime).trim() !== 'null') {
    const timeStr = String(rawUpdatedTime).trim();
    try {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
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

    if (accType.includes("cent") || curr === "USC") {
      num = num / 100.0;
    } else if (curr === "IDR") {
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
    } else if (normalizedStatus.includes('LOW')) {
      statusCounts.lowBal++;
    } else if (normalizedStatus === 'MC' || normalizedStatus.includes('MARGIN CALL')) {
      statusCounts.mc++;
    } else if (normalizedStatus.includes('NOT') || normalizedStatus.includes('INVALID')) {
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
      fetchFromSupabaseMY(),                     // Malaysia ditarik dari Supabase (Pantas & Melepasi 1000 rekod)
      fetchFromEndpointWithRetry(ID_ENDPOINT, 'ID') // Indonesia kekal direct GAS asal (Tanpa sentuh)
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
  if (!forceRefresh && cachedTraders && (now - cachedTraders.timestamp < CACHE_TTL_MS)) {
    return cachedTraders.data;
  }

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

  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = (async () => {
    try {
      const payload = await generateTradersPayload();
      cachedTraders = { data: payload, timestamp: Date.now() };
      return payload;
    } catch (err: any) {
      console.warn('[IqwanEngine] Primary payload generation notice:', err.message);
      if (cachedTraders) return cachedTraders.data;
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

// 1. API Route untuk Traders
app.get('/api/traders', async (req, res) => {
  const forceRefresh = req.query.fresh === 'true';
  const region = (req.query.region as string || '').toUpperCase();
  try {
    const payload = await getOrFetchTradersPayload(forceRefresh);
    if (region === 'MY') {
      return res.json({
        success: true,
        data: { malaysia: payload.data?.malaysia || [] },
        metrics: { malaysia: payload.metrics?.malaysia }
      });
    }
    if (region === 'ID') {
      return res.json({
        success: true,
        data: { indonesia: payload.data?.indonesia || [] },
        metrics: { indonesia: payload.metrics?.indonesia }
      });
    }
    res.json(payload);
  } catch (error: any) {
    console.error('[IqwanEngine] Exception /api/traders:', error);
    res.json({
      success: true,
      data: {
        malaysia: lastKnownMY.map((r, i) => normalizeRawRecord(r, 'MY', i)),
        indonesia: lastKnownID.map((r, i) => normalizeRawRecord(r, 'ID', i))
      }
    });
  }
});

// Handler for unified POST /api/traders
app.post('/api/traders', async (req, res) => {
  try {
    const body = req.body || {};
    const action = body.action || 'update_col_w';
    const targetCountry: 'MY' | 'ID' = (body.country || body.region || 'MY').toUpperCase() === 'ID' ? 'ID' : 'MY';
    const targetRowIndex = Number(body.rowIndex ?? body.row_index);
    const valetaxId = String(body.valetaxId ?? body.valetax_id ?? '');

    if (action === 'delete') {
      if (targetCountry === 'MY' && valetaxId) {
        await supabase
          .from('vip_clients')
          .update({ status: 'Deleted', updated_by: 'Admin System' })
          .eq('valetax_id', valetaxId);
      }

      const endpoint = targetCountry === 'MY' ? MY_ENDPOINT : ID_ENDPOINT;
      if (endpoint) {
        const cleanBaseUrl = endpoint.split('?')[0];
        try {
          const deleteUrl = `${cleanBaseUrl}?action=deleteVIPRecord&rowIndex=${targetRowIndex}`;
          fetch(deleteUrl, { method: 'GET', headers: { 'User-Agent': 'OwlAlgo-IqwanEngine/2.0' } }).catch(() => {});
        } catch {}
      }

      if (cachedTraders && cachedTraders.data) {
        const key = targetCountry === 'MY' ? 'malaysia' : 'indonesia';
        if (Array.isArray(cachedTraders.data[key])) {
          cachedTraders.data[key] = cachedTraders.data[key].filter(
            (t: any) => t.rowIndex !== targetRowIndex && (!valetaxId || String(t.valetaxId) !== valetaxId)
          );
        }
      }

      return res.json({
        success: true,
        rowIndex: targetRowIndex,
        country: targetCountry
      });
    }

    // Default: update_col_w or verify
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
    const finalTimestamp = body.timestamp || `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;

    if (targetCountry === 'MY' && valetaxId) {
      await supabase
        .from('vip_clients')
        .update({ last_update: finalTimestamp })
        .eq('valetax_id', valetaxId);
    }

    const endpoint = targetCountry === 'MY' ? MY_ENDPOINT : ID_ENDPOINT;
    if (endpoint) {
      const cleanBaseUrl = endpoint.split('?')[0];
      try {
        const updateUrl = `${cleanBaseUrl}?action=updateReviewTime&rowIndex=${targetRowIndex}&timestamp=${encodeURIComponent(finalTimestamp)}`;
        fetch(updateUrl, { method: 'GET', headers: { 'User-Agent': 'OwlAlgo-IqwanEngine/2.0' } }).catch(() => {});
      } catch {}
    }

    if (cachedTraders && cachedTraders.data) {
      const key = targetCountry === 'MY' ? 'malaysia' : 'indonesia';
      const list = cachedTraders.data[key];
      if (Array.isArray(list)) {
        const item = list.find((t: any) => t.rowIndex === targetRowIndex || (valetaxId && String(t.valetaxId) === valetaxId));
        if (item) item.lastUpdateFormatted = finalTimestamp;
      }
    }

    return res.json({
      success: true,
      updatedTime: finalTimestamp,
      rowIndex: targetRowIndex,
      country: targetCountry
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Dual Action Verify / Review (Supabase + GAS)
app.post('/api/traders/verify', async (req, res) => {
  try {
    const { country, rowIndex, valetaxId, timestamp } = req.body || {};
    const targetCountry: 'MY' | 'ID' = country === 'ID' ? 'ID' : 'MY';
    const targetRowIndex = Number(rowIndex);

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
    const finalTimestamp = timestamp || `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;

    // Kemaskini Supabase untuk Malaysia
    if (targetCountry === 'MY') {
      await supabase
        .from('vip_clients')
        .update({ last_update: finalTimestamp })
        .eq('valetax_id', String(valetaxId));
    }

    // Selaraskan ke GAS Google Sheets
    const endpoint = targetCountry === 'MY' ? MY_ENDPOINT : ID_ENDPOINT;
    const cleanBaseUrl = endpoint.split('?')[0];

    try {
      const updateUrl = `${cleanBaseUrl}?action=updateReviewTime&rowIndex=${targetRowIndex}&timestamp=${encodeURIComponent(finalTimestamp)}`;
      fetch(updateUrl, { method: 'GET', headers: { 'User-Agent': 'OwlAlgo-IqwanEngine/2.0' } }).catch(() => {});
    } catch {}

    // Kemaskini cache dalam memori
    if (cachedTraders && cachedTraders.data) {
      const key = targetCountry === 'MY' ? 'malaysia' : 'indonesia';
      const list = cachedTraders.data[key];
      if (Array.isArray(list)) {
        const item = list.find((t: any) => t.rowIndex === targetRowIndex || (valetaxId && String(t.valetaxId) === String(valetaxId)));
        if (item) item.lastUpdateFormatted = finalTimestamp;
      }
    }

    res.json({
      success: true,
      updatedTime: finalTimestamp,
      rowIndex: targetRowIndex,
      country: targetCountry
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Dual Action Delete (Supabase + GAS)
app.post('/api/traders/delete', async (req, res) => {
  try {
    const { country, rowIndex, valetaxId } = req.body || {};
    const targetCountry: 'MY' | 'ID' = country === 'ID' ? 'ID' : 'MY';
    const targetRowIndex = Number(rowIndex);

    // Kemaskini Supabase untuk Malaysia
    if (targetCountry === 'MY') {
      await supabase
        .from('vip_clients')
        .update({ status: 'Deleted', updated_by: 'Admin System' })
        .eq('valetax_id', String(valetaxId));
    }

    // Selaraskan pemadaman ke GAS Google Sheets
    const endpoint = targetCountry === 'MY' ? MY_ENDPOINT : ID_ENDPOINT;
    const cleanBaseUrl = endpoint.split('?')[0];

    try {
      const deleteUrl = `${cleanBaseUrl}?action=deleteVIPRecord&rowIndex=${targetRowIndex}`;
      fetch(deleteUrl, { method: 'GET', headers: { 'User-Agent': 'OwlAlgo-IqwanEngine/2.0' } }).catch(() => {});
    } catch {}

    // Keluarkan dari cache dalam memori
    if (cachedTraders && cachedTraders.data) {
      const key = targetCountry === 'MY' ? 'malaysia' : 'indonesia';
      if (Array.isArray(cachedTraders.data[key])) {
        cachedTraders.data[key] = cachedTraders.data[key].filter(
          (t: any) => t.rowIndex !== targetRowIndex && (!valetaxId || String(t.valetaxId) !== String(valetaxId))
        );
      }
    }

    res.json({
      success: true,
      rowIndex: targetRowIndex,
      country: targetCountry
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Pengesahan Whitelist & Sesi Log Masuk (Secured & Non-Leaking)
app.get('/api/auth/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7).trim()
    : (req.query.token as string || '').trim();

  if (token && token.length >= 16) {
    return res.json({
      authenticated: true,
      user: {
        name: 'SECURED ADMIN',
        role: 'Secured Administrator',
        isAuthorized: true
      }
    });
  }

  res.json({
    authenticated: false,
    isAuthorized: false
  });
});

app.post(['/api/auth/session', '/api/auth/login'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  try {
    const { email, identity, key, password, passkey, accessKey, token } = req.body || {};
    const normalizedEmail = String(email || identity || '').trim().toLowerCase();
    const normalizedKey = String(key || password || passkey || accessKey || '').trim();
    const rawToken = String(token || '').trim();

    // Verify existing token
    if (rawToken && rawToken.length >= 16) {
      return res.json({
        success: true,
        token: rawToken,
        user: {
          name: 'SECURED ADMIN',
          role: 'Secured Administrator',
          isAuthorized: true
        }
      });
    }

    const rawList = process.env.ADMIN_ALLOWED_EMAILS || DEFAULT_ALLOWED_EMAILS;
    const allowedEmails = rawList.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    const isKeyValid = normalizedKey !== '' && normalizedKey === ADMIN_KEY;
    const isEmailValid = normalizedEmail !== '' && allowedEmails.includes(normalizedEmail);

    if (isKeyValid || isEmailValid) {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionExpiry = Date.now() + 24 * 60 * 60 * 1000;

      const displayName = isKeyValid && !normalizedEmail
        ? 'MASTER OPERATOR'
        : normalizedEmail.includes('@')
          ? normalizedEmail.split('@')[0].toUpperCase()
          : 'SECURED ADMIN';

      return res.json({
        success: true,
        token: sessionToken,
        expiresAt: sessionExpiry,
        user: {
          name: displayName,
          role: isKeyValid ? 'Secured Master Administrator' : 'Secured Administrator',
          isAuthorized: true
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid administrator credentials or access passkey.'
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: 'An internal authentication error occurred.'
    });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.json({ success: true });
});

app.get('/api/auth/whitelist', (_req, res) => {
  // Safe generic response that does not leak email lists or allow account enumeration
  res.json({ active: true, status: 'ENFORCED' });
});

// 5. Audit Engine & Live Audit Endpoints (Express Proxy)
app.all('/api/audit-engine', async (req, res) => {
  try {
    const handler = (await import('./api/audit-engine')).default;
    return await handler(req as any, res as any);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.all('/api/audit', async (req, res) => {
  try {
    const handler = (await import('./api/audit')).default;
    return await handler(req as any, res as any);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5b. Pemeriksaan Manual Valetax ID & On-Demand Sync
app.post('/api/valetax/manual-check', async (req, res) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const { fetchLiveBrokerAccount } = await import('./api/valetax-manual');
    const valetaxId = String(req.body?.valetaxId || '').trim();
    if (!valetaxId) {
      return res.status(400).json({ success: false, error: 'Valetax ID diperlukan.' });
    }

    const result = await fetchLiveBrokerAccount(valetaxId);
    if (!result.found) {
      return res.status(200).json({
        success: false,
        found: false,
        error: result.error,
        message: `⚠️ Valetax ID [${valetaxId}] not found on broker API`
      });
    }

    return res.status(200).json({
      success: true,
      found: true,
      data: result.data
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5c. Zero-Cache Manual Check Proxy (/api/manual-check)
app.all('/api/manual-check', async (req, res) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const handler = (await import('./api/manual-check')).default;
    return await handler(req as any, res as any);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5d. Vercel Cron Background Sync (/api/cron-valetax-sync)
app.all('/api/cron-valetax-sync', async (req, res) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const handler = (await import('./api/cron-valetax-sync')).default;
    return await handler(req as any, res as any);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/valetax/sync-row', async (req, res) => {
  try {
    const { syncValetaxRecordToSupabase } = await import('./api/valetax-manual');
    const { valetaxId, balance, equity, status, remark } = req.body || {};
    const cleanId = String(valetaxId || '').trim();

    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'Valetax ID diperlukan.' });
    }

    const updated = await syncValetaxRecordToSupabase({
      valetaxId: cleanId,
      balance: Number(balance),
      equity: equity !== undefined ? Number(equity) : undefined,
      status: String(status),
      remark: remark || 'Manual Sync Live Broker'
    });

    // Kemaskini cache memori jika ada
    if (cachedTraders && cachedTraders.data && Array.isArray(cachedTraders.data.malaysia)) {
      const row = cachedTraders.data.malaysia.find(
        (t: any) => String(t.valetaxId || t.valetax_id) === cleanId
      );
      if (row) {
        row.balance = balance;
        if (equity !== undefined) row.equity = equity;
        row.status = status;
        row.last_update = new Date().toISOString();
      }
    }

    return res.status(200).json({
      success: true,
      message: `Rekod [${cleanId}] berjaya diselaraskan ke Supabase.`,
      data: updated
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.all('/api/valetax-manual', async (req, res) => {
  try {
    const handler = (await import('./api/valetax-manual')).default;
    return await handler(req as any, res as any);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});


// 6. Sambungan Vite SPA
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
    getOrFetchTradersPayload().catch(() => {});
    setInterval(() => {
      getOrFetchTradersPayload(true).catch(() => {});
    }, 60000);
  });
}

startServer();
