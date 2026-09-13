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
export function sanitizeBalance(val: any): number {
  if (val === undefined || val === null || val === "" || val === "-" || val === "undefined") return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  const str = String(val).trim();
  if (str === '' || str === '-' || /n\/?a/i.test(str)) return 0;

  // Remove thousand commas and any non-numeric characters except minus and period
  const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
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

  const balance = sanitizeBalance(raw.balance);
  const equity = sanitizeBalance(raw.equity);
  const credit = sanitizeBalance(raw.credit);
  const margin = sanitizeBalance(raw.margin);
  const leverage = Number(String(raw.leverage ?? 100).replace(/[^0-9.]/g, '')) || 100;
  const accountName = String(raw.account_name || '-');
  const server = String(raw.server || '-');
  const platform = String(raw.platform || 'meta4');
  const dateOfCreation = raw.date_of_creation ? String(raw.date_of_creation) : '';
  const status = String(raw.status || 'Active').trim();

  // STRICT COLUMN W NORMALIZATION - NO FALLBACKS
  let lastUpdateFormatted = '-';
  const rawW = raw.updated_time || raw.last_update || raw.updated_time_col_w || raw.review_time || raw.last_updated || raw.col_w;
  if (rawW && String(rawW).trim() !== '' && String(rawW).trim() !== '-' && String(rawW).trim() !== 'undefined' && String(rawW).trim() !== 'null') {
    lastUpdateFormatted = String(rawW).trim();
  }

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
      }
    } catch {
      registerDateFormatted = registerDate;
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
    let num = sanitizeBalance(trader.balance);
    
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
    const status = (t.status || "").toString().trim().toUpperCase();

    const isMC = status === "MC" || status.includes("MARGIN CALL");
    const isLowBal = status.includes("LOW") || status === "LOW BALANCE";
    const isValidVIP = (status.includes("VALID VIP") || status === "VIP") && !status.includes("INDICATOR");
    const isIndicate = status.includes("INDICATOR");
    const isNotValid = status.includes("NOT VALID") || status === "INVALID" || status === "DELETED" || status.includes("NOT");
    const isActive = status === "ACTIVE" || status === "VALID" || isValidVIP || isIndicate;

    if (isIndicate) {
      statusCounts.validVipIndicator++;
    } else if (isValidVIP) {
      statusCounts.validVip++;
    } else if (isActive) {
      statusCounts.active++;
    } else if (isLowBal) {
      statusCounts.lowBal++;
    } else if (isMC) {
      statusCounts.mc++;
    } else if (isNotValid) {
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
    currency: 'USD',
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
  const rawList = allowedEmailsEnv || '';
  if (!rawList) return false;
  
  const allowed = rawList
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  
  return allowed.includes(target);
}
