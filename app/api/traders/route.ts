/* Powered by IqwanEngine */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MY_ENDPOINT = process.env.GOOGLE_SHEETS_MY_ENDPOINT || '';
const ID_ENDPOINT = process.env.GOOGLE_SHEETS_ID_ENDPOINT || '';

function getCleanUrl(endpoint: string) {
  if (!endpoint) return '';
  return endpoint.split('?')[0] + '?action=fetch';
}

async function fetchGAS(url: string) {
  const cleanUrl = getCleanUrl(url);
  if (!cleanUrl) return [];
  
  try {
    const res = await fetch(cleanUrl, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
  } catch (err) {
    console.error('GAS Fetch error:', err);
    return [];
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
  const balance = typeof raw.balance === 'number' ? raw.balance : Number(raw.balance) || 0;
  const equity = typeof raw.equity === 'number' ? raw.equity : Number(raw.equity) || 0;
  const credit = typeof raw.credit === 'number' ? raw.credit : Number(raw.credit) || 0;
  const margin = typeof raw.margin === 'number' ? raw.margin : Number(raw.margin) || 0;
  const leverage = Number(raw.leverage) || 100;
  const accountName = String(raw.account_name || '-');
  const accountType = String(raw.account_type || '-');
  const server = String(raw.server || '-');
  const platform = String(raw.platform || 'meta4');
  const dateOfCreation = raw.date_of_creation ? String(raw.date_of_creation) : '';
  const currency = String(raw.currency || 'USD').toUpperCase();
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
      }
    } catch {}
  }

  let lastUpdateFormatted = registerDateFormatted;

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

export async function GET() {
  try {
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

    const allDates = [...myTraders, ...idTraders]
      .map(t => t.registerDate)
      .filter(Boolean)
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const latestRegistrationDate = allDates.length > 0
      ? allDates[0].toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }) + ' (MYT)'
      : null;

    const lastUpdateByEngine = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }) + ' (MYT)';

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      latestRegistrationDate,
      lastUpdateByEngine,
      data: {
        malaysia: myTraders,
        indonesia: idTraders
      }
    });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
