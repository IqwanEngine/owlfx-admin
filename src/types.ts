/* Powered by IqwanEngine */

export interface RawTrader {
  row_index?: number;
  trader_name?: string;
  contact_number?: string | number;
  register_email?: string;
  trading_view_username?: string;
  valetax_id?: string | number;
  register_date?: string;
  service_days?: string | number;
  updated_by?: string;
  level?: number;
  direct_partner_email?: string;
  balance?: number;
  equity?: number;
  credit?: number;
  margin?: number;
  leverage?: number;
  account_name?: string;
  account_type?: string;
  server?: string;
  platform?: string;
  date_of_creation?: string;
  currency?: string;
  status?: string;
  updated_time?: string;
  last_update?: string;
  review_time?: string;
  updated_time_col_w?: string;
  [key: string]: unknown;
}

export interface TraderRecord {
  id: string;
  rowIndex: number;
  traderName: string;
  contactNumber: string;
  registerEmail: string;
  tradingViewUsername: string;
  valetaxId: string;
  registerDate: string;
  serviceDays: string;
  updatedBy: string;
  level: number;
  directPartnerEmail: string;
  balance: number;
  equity: number;
  credit: number;
  margin: number;
  leverage: number;
  accountName: string;
  accountType: string;
  server: string;
  platform: string;
  dateOfCreation: string;
  currency: string;
  status: string;
  country: 'MY' | 'ID';
  lastUpdateFormatted: string;
  registerDateFormatted: string;
  raw: RawTrader;
}

export interface StatusCounts {
  active: number;
  lowBal: number;
  mc: number;
  notValid: number;
  validVip: number;
  validVipIndicator: number;
  other: number;
  total: number;
}

export type DatePreset = 'all' | 'today' | 'yesterday' | 'last7days' | 'thismonth' | 'custom';
export type BalancePreset = 'all' | 'zero_mc' | 'under_30' | '30_to_99' | '100_plus' | 'custom';

export interface MultiColumnFilterState {
  // 1. Register Date Filter
  datePreset: DatePreset;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  // 2. Balance Filter
  balancePreset: BalancePreset;
  minBalance: string;
  maxBalance: string;
  // 3. Account Type Filter
  accountType: string; // '' or specific type
  // 4. Partner Email Filter
  partnerEmail: string; // '' or specific email/search
  // 5. Status Filter
  status: string; // '' or specific category
}

export interface CountryMetrics {
  country: 'MY' | 'ID';
  countryName: string;
  totalTraders: number;
  totalBalanceUSD: number;
  statusBreakdown: StatusCounts;
}

export interface TradersApiResponse {
  success: boolean;
  timestamp: string;
  latestRegistrationDate: string | null;
  lastUpdateByEngine: string;
  data: {
    malaysia: TraderRecord[];
    indonesia: TraderRecord[];
  };
  metrics: {
    malaysia: CountryMetrics;
    indonesia: CountryMetrics;
    combined: {
      totalTraders: number;
      totalBalanceUSD: number;
    };
  };
  error?: string;
}

export interface AuthUser {
  email: string;
  name?: string;
  isAuthorized: boolean;
  avatarUrl?: string;
  role?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthorized: boolean;
  errorMessage?: string;
}
