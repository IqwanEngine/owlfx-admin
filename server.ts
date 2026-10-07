/* Powered by IqwanEngine */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
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

const MY_ENDPOINT = process.env.GOOGLE_SHEETS_MY_ENDPOINT || '';
const ID_ENDPOINT = process.env.GOOGLE_SHEETS_ID_ENDPOINT || '';
const ADMIN_KEY = process.env.ADMIN_DASHBOARD_KEY || 'IE_Admin#Gold2026!Master';

function getCleanUrl(endpoint: string) {
  if (!endpoint) return '';
  return endpoint.split('?')[0] + `?action=fetch&key=${encodeURIComponent(ADMIN_KEY)}`;
}

const DEFAULT_ALLOWED_EMAILS = process.env.ADMIN_ALLOWED_EMAILS || '';

interface CachePayload {
  data: any;
  timestamp: number;
}
let cachedTraders: CachePayload | null = null;
const CACHE_TTL_MS = 25000;

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
  if (!cleanUrl) return [];

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40000);

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
      console.warn(`[IqwanEngine] Fetch attempt ${attempt + 1}/${retries + 1} for ${country} failed:`, error.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 800));
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
  try {
    const payload = await getOrFetchTradersPayload(forceRefresh);
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

// 4. Pengesahan Whitelist & Sesi Log Masuk
app.get('/api/auth/whitelist', (req, res) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  const rawList = process.env.ADMIN_ALLOWED_EMAILS || DEFAULT_ALLOWED_EMAILS;
  const allowed = rawList.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  res.json({ email, isWhitelisted: allowed.includes(email) });
});

app.post('/api/auth/session', (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = (email || '').trim().toLowerCase();
  const rawList = process.env.ADMIN_ALLOWED_EMAILS || DEFAULT_ALLOWED_EMAILS;
  const allowed = rawList.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  if (!normalizedEmail || !allowed.includes(normalizedEmail)) {
    return res.status(403).json({ success: false, error: 'Unauthorized Email' });
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

// 5. Sambungan Vite SPA
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
    }, 30000);
  });
}

startServer();
