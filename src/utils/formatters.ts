/* Powered by IqwanEngine */

import { RawTrader, TraderRecord, StatusCounts, CountryMetrics } from '../types';

/**
 * Smart regional phone sanitization supporting Malaysian (+60) and Indonesian (+62) numbers.
 */
export function sanitizePhone_(rawPhone: any, region: 'MY' | 'ID' = 'MY'): string {
  if (!rawPhone || String(rawPhone).trim() === '' || String(rawPhone).trim() === '-') {
    return '-';
  }

  // 1.1 Character Stripping: Remove all non-digit characters except the leading plus sign
  let cleaned = String(rawPhone).trim();
  const hasLeadingPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/[^\d+]/g, '');
  
  // Ensure only at most one leading '+' exists
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
  } else if (hasLeadingPlus) {
    cleaned = '+' + cleaned.replace(/\+/g, '');
  }

  if (!cleaned || cleaned === '+') {
    return '-';
  }

  // 1.2 Explicit International Formats
  // If the number starts with +60 or +62, preserve exact string
  if (cleaned.startsWith('+60') || cleaned.startsWith('+62')) {
    return cleaned;
  }
  // If starts with 60 or 62 without plus
  if (cleaned.startsWith('60') && cleaned.length >= 9) {
    return '+' + cleaned;
  }
  if (cleaned.startsWith('62') && cleaned.length >= 9) {
    return '+' + cleaned;
  }

  // 1.3 Local Zero Prefix Smart Routing
  // If starts with 08 (standard Indonesian local prefix e.g. 08123456789 -> +628123456789)
  if (cleaned.startsWith('08')) {
    return '+62' + cleaned.substring(1);
  }
  // If starts with 01 (standard Malaysian local prefix e.g. 0123456789 -> +60123456789)
  if (cleaned.startsWith('01')) {
    return '+60' + cleaned.substring(1);
  }
  // For other numbers starting with 0, route by region parameter
  if (cleaned.startsWith('0')) {
    const prefix = region === 'ID' ? '+62' : '+60';
    return prefix + cleaned.substring(1);
  }

  // If number starts without 0 or international prefix
  const defaultPrefix = region === 'ID' ? '+62' : '+60';
  return defaultPrefix + cleaned;
}

/**
 * Generate a secure, one-click WhatsApp chat API link.
 */
export function generateWhatsAppLink(
  phone: string,
  traderName: string,
  valetaxId: string,
  region: 'MY' | 'ID' = 'MY'
): string | null {
  const sanitized = sanitizePhone_(phone, region);
  if (!sanitized || sanitized === '-') return null;

  // Extract strictly raw digits (stripping '+' and any other non-digit characters)
  const cleanDigits = sanitized.replace(/\D/g, '');
  if (!cleanDigits || cleanDigits.length < 8) return null;

  const safeTraderName = traderName || 'Trader';
  const safeValetaxId = valetaxId || '-';
  const message = `Salam ${safeTraderName}, berkenaan akaun Valetax ID: ${safeValetaxId} anda...`;

  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
}

/**
 * Clean and safely parse balance, equity, credit, and margin values from raw inputs.
 * Strips thousand-separator commas, currency symbols, and handles Cent / N/A values.
 */
export function sanitizeBalance(raw: any, accountType: string = '', currency: string = ''): number {
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

export function normalizeTrader(raw: RawTrader, country: 'MY' | 'ID', index: number): TraderRecord {
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

  // Format register date
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

  // Format last update strictly from Column W (Column 23 - "Updated TIME")
  let lastUpdateFormatted = '-';
  const rawUpdatedTime = raw.updated_time ?? raw.last_update ?? raw.updated_time_col_w ?? raw.review_time ?? raw.last_updated ?? raw.col_w;
  if (rawUpdatedTime && String(rawUpdatedTime).trim() !== '' && String(rawUpdatedTime).trim() !== '-' && String(rawUpdatedTime).trim() !== 'undefined' && String(rawUpdatedTime).trim() !== 'null') {
    const timeStr = String(rawUpdatedTime).trim();
    try {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        lastUpdateFormatted = `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
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

export function calculateTotalBalanceUSD(traders: { balance?: any; accountType?: string; account_type?: string; currency?: string }[]): number {
  return traders.reduce((acc, trader) => {
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
}

export function calculateMetrics(traders: TraderRecord[], country: 'MY' | 'ID'): CountryMetrics {
  const statusCounts: StatusCounts = {
    active: 0,
    lowBal: 0,
    mc: 0,
    notValid: 0,
    validVip: 0,
    validVipIndicator: 0,
    other: 0,
    total: traders.length
  };

  const totalBalanceUSD = calculateTotalBalanceUSD(traders);

  for (const t of traders) {
    const normalizedStatus = t.status.trim().toUpperCase();

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

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatLiveTimestamp(date: Date = new Date()): string {
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kuala_Lumpur'
  }) + ' (MYT/GMT+8)';
}

export function isEmailWhitelisted(email: string, allowedEmailsEnv?: string): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  // In production, the whitelist should be checked against the backend.
  // This client-side check is only for UI feedback and should use the list provided by the server.
  const rawList = allowedEmailsEnv || '';
  if (!rawList) return false;
  
  const allowed = rawList
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  
  return allowed.includes(target);
}
