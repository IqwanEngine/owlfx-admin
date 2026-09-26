/* Powered by IqwanEngine */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const MY_ENDPOINT = process.env.GOOGLE_SHEETS_MY_ENDPOINT || process.env.VITE_GOOGLE_SHEETS_MY_ENDPOINT || '';
const ID_ENDPOINT = process.env.GOOGLE_SHEETS_ID_ENDPOINT || process.env.VITE_GOOGLE_SHEETS_ID_ENDPOINT || '';
const ADMIN_KEY = process.env.ADMIN_DASHBOARD_KEY || 'IE_Admin#Gold2026!Master';

function getCleanUrl(endpoint: string, action: string = 'fetch') {
  if (!endpoint) return '';
  return endpoint.split('?')[0] + `?action=${action}&key=${encodeURIComponent(ADMIN_KEY)}`;
}

async function fetchGAS(url: string) {
  const cleanUrl = getCleanUrl(url);
  if (!cleanUrl) return [];
  
  try {
    const res = await fetch(cleanUrl, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!res.ok) {
      throw new Error(`GAS fetch failed with status: ${res.status}`);
    }

    const json = await res.json();

    // Catch success: false from GAS
    if (json && json.success === false) {
      throw new Error(json.message || 'GAS reported failure');
    }

    return Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
  } catch (err) {
    console.error('GAS Fetch error:', err);
    throw err; // Don't return empty array silently
  }
}

function normalize(raw: any, country: 'MY' | 'ID', index: number) {
  const rowIdx = raw.row_index ?? index + 1;
  const traderName = String(raw.trader_name || 'UNKNOWN TRADER').trim().toUpperCase();
  const contactNumber = String(raw.contact_number || '-').trim();
  const registerEmail = String(raw.register_email || '').trim().toLowerCase();
  const tradingViewUsername = String(raw.trading_view_username || '-').trim();
  const valetaxId = String(raw.valetax_id || '-').trim();
  const registerDate = raw.register_date ? String(raw.register_date) : '';
  const serviceDays = String(raw.service_days ?? '-');
  const updatedBy = String(raw.updated_by || 'System Form');
  const level = Number(raw.level) || 1;
  const directPartnerEmail = String(raw.direct_partner_email || '-').trim();
  const balance = typeof raw.balance === 'number' ? raw.balance : parseFloat(String(raw.balance || '0').replace(/[^0-9.-]+/g, "")) || 0;
  const equity = typeof raw.equity === 'number' ? raw.equity : parseFloat(String(raw.equity || '0').replace(/[^0-9.-]+/g, "")) || 0;
  const credit = typeof raw.credit === 'number' ? raw.credit : parseFloat(String(raw.credit || '0').replace(/[^0-9.-]+/g, "")) || 0;
  const margin = typeof raw.margin === 'number' ? raw.margin : parseFloat(String(raw.margin || '0').replace(/[^0-9.-]+/g, "")) || 0;
  const leverage = Number(raw.leverage) || 100;
  const accountName = String(raw.account_name || '-');
  const accountType = String(raw.account_type || '-');
  const server = String(raw.server || '-');
  const platform = String(raw.platform || 'meta4');
  const dateOfCreation = raw.date_of_creation ? String(raw.date_of_creation) : '';
  const currency = String(raw.currency || 'USD').toUpperCase();
  const status = String(raw.status || 'Active').trim();

  // Column W normalization - STRIKT
  let lastUpdateFormatted = '-';
  const rawW = raw.updated_time || raw.last_update || raw.updated_time_col_w || raw.col_w;
  if (rawW && String(rawW).trim() !== '' && String(rawW).trim() !== '-' && String(rawW).trim() !== 'undefined') {
    lastUpdateFormatted = String(rawW).trim();
  }

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
      }
    } catch {}
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      // Ambil kesemua parameter yang mungkin dihantar oleh frontend
      const { action, region, row_index, rowIndex, valetax_id, timestamp, updateData } = req.body;
      
      if (!action) {
        return res.status(400).json({ success: false, error: "Tindakan (action) tidak disediakan." });
      }

      // Tentukan endpoint berdasarkan wilayah
      const endpoint = region === 'ID' ? ID_ENDPOINT : MY_ENDPOINT;
      
      // Bina URL dengan menyertakan Kunci Keselamatan dan action
      const postUrl = getCleanUrl(endpoint, action);

      // Hantar arahan ke Google Apps Script
      const gasRes = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          row_index: row_index || rowIndex, // Sokong kedua-dua format
          rowIndex: row_index || rowIndex,
          valetax_id: valetax_id,
          timestamp: timestamp,
          updateData: updateData
        })
      });

      const gasData = await gasRes.json();
      return res.status(200).json({ success: true, data: gasData });

    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // HANDLE GET: FETCH DATA
  try {
    const region = req.query.region as string; // 'MY' or 'ID' or undefined

    if (region === 'MY') {
      const rawMY = await fetchGAS(MY_ENDPOINT);
      const myTraders = rawMY.map((r, i) => normalize(r, 'MY', i)).sort((a, b) => {
        const timeA = a.registerDate ? new Date(a.registerDate).getTime() : 0;
        const timeB = b.registerDate ? new Date(b.registerDate).getTime() : 0;
        return (timeB || 0) - (timeA || 0);
      });
      return res.status(200).json({ success: true, data: { malaysia: myTraders } });
    }

    if (region === 'ID') {
      const rawID = await fetchGAS(ID_ENDPOINT);
      const idTraders = rawID.map((r, i) => normalize(r, 'ID', i)).sort((a, b) => {
        const timeA = a.registerDate ? new Date(a.registerDate).getTime() : 0;
        const timeB = b.registerDate ? new Date(b.registerDate).getTime() : 0;
        return (timeB || 0) - (timeA || 0);
      });
      return res.status(200).json({ success: true, data: { indonesia: idTraders } });
    }

    // Default: Fetch Both (legacy support)
    const [rawMY, rawID] = await Promise.all([
      fetchGAS(MY_ENDPOINT),
      fetchGAS(ID_ENDPOINT)
    ]);

    const sortFn = (a: any, b: any) => {
      const timeA = a.registerDate ? new Date(a.registerDate).getTime() : 0;
      const timeB = b.registerDate ? new Date(b.registerDate).getTime() : 0;
      return (timeB || 0) - (timeA || 0);
    };

    const myTraders = rawMY.map((r, i) => normalize(r, 'MY', i)).sort(sortFn);
    const idTraders = rawID.map((r, i) => normalize(r, 'ID', i)).sort(sortFn);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        malaysia: myTraders,
        indonesia: idTraders
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
