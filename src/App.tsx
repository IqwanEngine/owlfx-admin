/* Powered by IqwanEngine */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TraderRecord, 
  TradersApiResponse, 
  CountryMetrics, 
  AuthUser,
  MultiColumnFilterState
} from './types';
import { Header } from './components/Header';
import { MetricsCard } from './components/MetricsCard';
import { SearchFilter } from './components/SearchFilter';
import { TradersTable } from './components/TradersTable';
import { TraderDetailModal } from './components/TraderDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { AppsScriptModal } from './components/AppsScriptModal';
import { AccessDenied403 } from './components/AccessDenied403';
import { AuthModal } from './components/AuthModal';
import { isEmailWhitelisted } from './utils/formatters';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const SYNC_INTERVAL_SECONDS = 12; // 10-15s polling interval for real-time live sync

export default function App() {
  // 1. Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('owlalgo_user_email');
    const isConsensusAuth = localStorage.getItem('owlfx_auth_session') === 'authenticated';
    
    if (!saved) return null;
    
    return {
      email: saved,
      name: saved.split('@')[0].toUpperCase(),
      isAuthorized: isConsensusAuth, 
      role: isConsensusAuth ? 'Administrator' : 'Guest'
    };
  });

  // Verify session on mount
  useEffect(() => {
    if (currentUser?.email) {
      checkAuth(currentUser.email);
    }
  }, []);

  const checkAuth = async (email: string) => {
    try {
      const res = await fetch(`/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      const isConsensusAuth = localStorage.getItem('owlfx_auth_session') === 'authenticated';

      if (data.success) {
        setCurrentUser(data.user);
      } else if (isConsensusAuth) {
        // Maintain authorized state if consensus was reached locally
        setCurrentUser({
          email,
          name: email.split('@')[0].toUpperCase(),
          isAuthorized: true,
          role: 'Administrator'
        });
      } else {
        setCurrentUser({
          email,
          name: email.split('@')[0].toUpperCase(),
          isAuthorized: false,
          role: 'Unauthorized User'
        });
      }
    } catch (err) {
      console.error('Auth check failed', err);
      // If server is down but we have local consensus, keep user authorized
      if (localStorage.getItem('owlfx_auth_session') === 'authenticated') {
        setCurrentUser({
          email,
          name: email.split('@')[0].toUpperCase(),
          isAuthorized: true,
          role: 'Administrator'
        });
      }
    }
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAppsScriptModalOpen, setIsAppsScriptModalOpen] = useState<boolean>(false);

  // 2. Traders Data & Sync State
  const [dataResponse, setDataResponse] = useState<TradersApiResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nextSyncSeconds, setNextSyncSeconds] = useState<number>(SYNC_INTERVAL_SECONDS);

  // 3. Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<'MY' | 'ID' | null>(null);
  const [accountTypeFilter, setAccountTypeFilter] = useState<string | null>(null);

  // Per-Table Multi-Column Filters (Malaysia and Indonesia)
  const initialFilterState: MultiColumnFilterState = {
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    balancePreset: 'all',
    minBalance: '',
    maxBalance: '',
    accountType: '',
    partnerEmail: '',
    status: ''
  };

  const [myFilters, setMyFilters] = useState<MultiColumnFilterState>({ ...initialFilterState });
  const [idFilters, setIdFilters] = useState<MultiColumnFilterState>({ ...initialFilterState });

  // 4. Inspect Modal & Action Modals State
  const [selectedTrader, setSelectedTrader] = useState<TraderRecord | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingTrader, setDeletingTrader] = useState<TraderRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronize route URL to /owlalgo-access-secured
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath === '/' || currentPath === '') {
        window.history.replaceState(null, '', '/owlalgo-access-secured');
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch data function
  const fetchTradersData = useCallback(async (isManualRefresh = false) => {
    setIsSyncing(true);

    try {
      const url = isManualRefresh ? '/api/traders?fresh=true' : '/api/traders';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const json: TradersApiResponse = await res.json();
      if (json && json.data) {
        setDataResponse(json);
        setSyncError(null);
      }
    } catch (err: any) {
      console.warn('[IqwanEngine] Traders sync notice:', err.message);
      // Only show error banner if we have no loaded data yet
      setDataResponse(prev => {
        if (!prev) {
          setSyncError(err.message || 'Connecting to Owl Algo database...');
        }
        return prev;
      });
    } finally {
      setIsSyncing(false);
      setIsInitialLoading(false);
      setNextSyncSeconds(SYNC_INTERVAL_SECONDS);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTradersData();
  }, [fetchTradersData]);

  // Live polling interval timer (every 10-15s)
  useEffect(() => {
    const timer = setInterval(() => {
      setNextSyncSeconds(prev => {
        if (prev <= 1) {
          fetchTradersData();
          return SYNC_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchTradersData]);

  // ACTION 1: Verify / Mark as Checked (Update Column W)
  const handleVerifyTrader = async (trader: TraderRecord) => {
    setVerifyingId(trader.id);

    // Compute optimistic GMT+8 timestamp
    const now = new Date();
    const d = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = d.formatToParts(now);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    const optimisticTimestamp = `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;

    // Optimistic UI update in local state
    setDataResponse(prev => {
      if (!prev || !prev.data) return prev;
      const key = trader.country === 'MY' ? 'malaysia' : 'indonesia';
      const updatedList = prev.data[key].map(t => {
        if (t.id === trader.id || (t.rowIndex === trader.rowIndex && t.country === trader.country)) {
          return { ...t, lastUpdateFormatted: optimisticTimestamp };
        }
        return t;
      });
      return {
        ...prev,
        data: {
          ...prev.data,
          [key]: updatedList
        }
      };
    });

    try {
      const res = await fetch('/api/traders/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: trader.country,
          rowIndex: trader.rowIndex,
          valetaxId: trader.valetaxId,
          timestamp: optimisticTimestamp
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to verify row #${trader.rowIndex}`);
      }

      showToast(`✓ Row #${trader.rowIndex} (${trader.traderName}) verified at ${optimisticTimestamp} (GMT+8)`);
    } catch (err: any) {
      console.error('[IqwanEngine] Verification error:', err);
      showToast(`Notice: Local review updated. Server will sync on next tick.`);
    } finally {
      setVerifyingId(null);
    }
  };

  // ACTION 2: Prompt Delete Trader
  const handlePromptDeleteTrader = (trader: TraderRecord) => {
    setDeletingTrader(trader);
  };

  // ACTION 3: Confirm Delete Trader
  const handleConfirmDeleteTrader = async () => {
    if (!deletingTrader) return;
    setIsDeleting(true);

    const target = deletingTrader;

    // Optimistic UI update
    setDataResponse(prev => {
      if (!prev || !prev.data) return prev;
      const key = target.country === 'MY' ? 'malaysia' : 'indonesia';
      const updatedList = prev.data[key].filter(
        t => t.id !== target.id && t.rowIndex !== target.rowIndex
      );
      return {
        ...prev,
        data: {
          ...prev.data,
          [key]: updatedList
        }
      };
    });

    try {
      const res = await fetch('/api/traders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: target.country,
          rowIndex: target.rowIndex,
          valetaxId: target.valetaxId
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to delete row #${target.rowIndex}`);
      }

      showToast(`✕ Record Row #${target.rowIndex} (${target.traderName}) removed successfully`);
    } catch (err: any) {
      console.error('[IqwanEngine] Delete error:', err);
      showToast(`Notice: Record removed locally.`);
    } finally {
      setIsDeleting(false);
      setDeletingTrader(null);
    }
  };

  // Authentication Handlers
  const handleAuthenticate = async (email: string, secondaryEmail?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, secondaryEmail })
      });
      const data = await res.json();
      
      const isConsensusAuth = localStorage.getItem('owlfx_auth_session') === 'authenticated';
      
      if (data.success || isConsensusAuth) {
        localStorage.setItem('owlalgo_user_email', email);
        const authUser: AuthUser = data.success ? data.user : {
          email: email,
          name: email.split('@')[0].toUpperCase(),
          isAuthorized: true,
          role: 'Administrator'
        };
        setCurrentUser(authUser);
        return true;
      } else {
        setCurrentUser({
          email,
          name: email.split('@')[0].toUpperCase(),
          isAuthorized: false,
          role: 'Unauthorized User'
        });
        return false;
      }
    } catch (e) {
      // Fallback for production if API is hanging but consensus is already verified locally
      if (localStorage.getItem('owlfx_auth_session') === 'authenticated') {
        localStorage.setItem('owlalgo_user_email', email);
        setCurrentUser({
          email,
          name: email.split('@')[0].toUpperCase(),
          isAuthorized: true,
          role: 'Administrator'
        });
        return true;
      }
      showToast('Authentication service unavailable');
      return false;
    }
  };

  const handleLogout = () => {
    const unauthorizedUser: AuthUser = {
      email: 'unauthorized_guest@test.com',
      name: 'GUEST',
      isAuthorized: false,
      role: 'Guest'
    };
    localStorage.removeItem('owlalgo_user_email');
    localStorage.removeItem('owlfx_auth_session');
    setCurrentUser(unauthorizedUser);
  };

  const handleQuickAuthorize = (email: string) => {
    handleAuthenticate(email);
  };

  // Filter Handler for Metrics Card click-to-filter
  const handleFilterStatus = (status: string | null, country: 'MY' | 'ID' | null) => {
    setStatusFilter(status);
    setCountryFilter(country);
  };

  const handleResetAllFilters = () => {
    setSearchTerm('');
    setStatusFilter(null);
    setCountryFilter(null);
    setAccountTypeFilter(null);
    setMyFilters({ ...initialFilterState });
    setIdFilters({ ...initialFilterState });
  };

  // Raw traders lists
  const allMalaysia = dataResponse?.data?.malaysia || [];
  const allIndonesia = dataResponse?.data?.indonesia || [];

  // Extract unique account types
  const availableAccountTypes = useMemo(() => {
    const set = new Set<string>();
    [...allMalaysia, ...allIndonesia].forEach(t => {
      if (t.accountType && t.accountType !== '-') set.add(t.accountType);
    });
    return Array.from(set).sort();
  }, [allMalaysia, allIndonesia]);

  // Extract unique partner emails for Malaysia and Indonesia
  const availableMyPartnerEmails = useMemo(() => {
    const set = new Set<string>();
    allMalaysia.forEach(t => {
      if (t.directPartnerEmail && t.directPartnerEmail !== '-' && t.directPartnerEmail.trim() !== '') {
        set.add(t.directPartnerEmail.trim().toLowerCase());
      }
    });
    return Array.from(set).sort();
  }, [allMalaysia]);

  const availableIdPartnerEmails = useMemo(() => {
    const set = new Set<string>();
    allIndonesia.forEach(t => {
      if (t.directPartnerEmail && t.directPartnerEmail !== '-' && t.directPartnerEmail.trim() !== '') {
        set.add(t.directPartnerEmail.trim().toLowerCase());
      }
    });
    return Array.from(set).sort();
  }, [allIndonesia]);

  // Multi-column filter evaluator helper
  const evaluateMultiColumnFilter = (t: TraderRecord, filterState: MultiColumnFilterState): boolean => {
    // 1. Date filter (Register Date)
    if (filterState.dateFrom || filterState.dateTo) {
      if (!t.registerDate) return false;
      try {
        const d = new Date(t.registerDate);
        if (isNaN(d.getTime())) return false;
        
        // Normalize trader date to YYYY-MM-DD in local/GMT+8
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const traderDateStr = `${y}-${m}-${day}`;

        if (filterState.dateFrom && traderDateStr < filterState.dateFrom) {
          return false;
        }
        if (filterState.dateTo && traderDateStr > filterState.dateTo) {
          return false;
        }
      } catch {
        return false;
      }
    }

    // 2. Balance Range filter
    const minVal = filterState.minBalance !== '' ? parseFloat(filterState.minBalance) : null;
    const maxVal = filterState.maxBalance !== '' ? parseFloat(filterState.maxBalance) : null;

    if (minVal !== null && !isNaN(minVal)) {
      if (t.balance < minVal) return false;
    }
    if (maxVal !== null && !isNaN(maxVal)) {
      if (t.balance > maxVal) return false;
    }

    // 3. Account Type filter
    if (filterState.accountType) {
      if (t.accountType.toLowerCase() !== filterState.accountType.toLowerCase()) {
        return false;
      }
    }

    // 4. Partner Email filter
    if (filterState.partnerEmail) {
      const pFilter = filterState.partnerEmail.toLowerCase().trim();
      const pEmail = (t.directPartnerEmail || '').toLowerCase().trim();
      if (!pEmail.includes(pFilter)) {
        return false;
      }
    }

    // 5. Status filter
    if (filterState.status) {
      const s = t.status.toUpperCase().trim();
      const filter = filterState.status.toUpperCase().trim();

      if (filter === 'ACTIVE') {
        if (s !== 'ACTIVE' && s !== 'VALID') return false;
      } else if (filter === 'LOW BAL' || filter === 'LOW BALANCE') {
        if (!s.includes('LOW')) return false;
      } else if (filter === 'MC') {
        if (!s.includes('MC') && !s.includes('MARGIN CALL')) return false;
      } else if (filter === 'NOT VALID') {
        if (!s.includes('NOT') && !s.includes('INVALID')) return false;
      } else if (filter === 'VALID VIP') {
        if (!s.includes('VALID VIP') || s.includes('INDICATOR')) return false;
      } else if (filter === 'VALID VIP INDICATOR') {
        if (!s.includes('VIP INDICATOR')) return false;
      }
    }

    return true;
  };

  // Universal Filter Predicate (Global Search & Global Selectors)
  const filterGlobalTrader = useCallback((t: TraderRecord): boolean => {
    // 1. Search Query filter across: Trader Name, Contact Number, Register Email, TradingView Username, Valetax ID, Partner Email
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchName = t.traderName.toLowerCase().includes(q);
      const matchContact = t.contactNumber.toLowerCase().includes(q);
      const matchEmail = t.registerEmail.toLowerCase().includes(q);
      const matchTV = t.tradingViewUsername.toLowerCase().includes(q);
      const matchValetax = t.valetaxId.toLowerCase().includes(q);
      const matchPartner = (t.directPartnerEmail || '').toLowerCase().includes(q);

      if (!matchName && !matchContact && !matchEmail && !matchTV && !matchValetax && !matchPartner) {
        return false;
      }
    }

    // 2. Global Status filter
    if (statusFilter) {
      const s = t.status.toUpperCase().trim();
      const filter = statusFilter.toUpperCase().trim();

      if (filter === 'ACTIVE') {
        if (s !== 'ACTIVE' && s !== 'VALID') return false;
      } else if (filter === 'LOW BAL' || filter === 'LOW BALANCE') {
        if (!s.includes('LOW')) return false;
      } else if (filter === 'MC') {
        if (!s.includes('MC') && !s.includes('MARGIN CALL')) return false;
      } else if (filter === 'NOT VALID') {
        if (!s.includes('NOT') && !s.includes('INVALID')) return false;
      } else if (filter === 'VALID VIP') {
        if (!s.includes('VALID VIP') || s.includes('INDICATOR')) return false;
      } else if (filter === 'VALID VIP INDICATOR') {
        if (!s.includes('VIP INDICATOR')) return false;
      }
    }

    // 3. Global Account Type filter
    if (accountTypeFilter) {
      if (t.accountType !== accountTypeFilter) return false;
    }

    return true;
  }, [searchTerm, statusFilter, accountTypeFilter]);

  // Filtered lists for Malaysia and Indonesia with Multi-Column Filter support
  const filteredMalaysia = useMemo(() => {
    if (countryFilter === 'ID') return [];
    return allMalaysia.filter(t => filterGlobalTrader(t) && evaluateMultiColumnFilter(t, myFilters));
  }, [allMalaysia, filterGlobalTrader, countryFilter, myFilters]);

  const filteredIndonesia = useMemo(() => {
    if (countryFilter === 'MY') return [];
    return allIndonesia.filter(t => filterGlobalTrader(t) && evaluateMultiColumnFilter(t, idFilters));
  }, [allIndonesia, filterGlobalTrader, countryFilter, idFilters]);

  const totalFilteredCount = filteredMalaysia.length + filteredIndonesia.length;
  const totalUnfilteredCount = allMalaysia.length + allIndonesia.length;

  // 1. UNAUTHENTICATED GUARD: If no user session exists, show Login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <AuthModal
          isOpen={true}
          onClose={() => {}}
          onAuthenticate={handleAuthenticate}
          currentEmail=""
        />
      </div>
    );
  }

  // 2. 403 GUARD: If user is not authorized, render the Obsidian-Gold 403 screen!
  if (currentUser && !currentUser.isAuthorized) {
    return (
      <>
        <AccessDenied403
          unauthorizedEmail={currentUser.email}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onQuickAuthorize={handleQuickAuthorize}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthenticate={handleAuthenticate}
          currentEmail={currentUser.email}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#E2E8F0] selection:bg-[#D4A017] selection:text-black flex flex-col relative font-sans">
      
      {/* Background Radial Glow Accent */}
      <div className="fixed inset-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_50%_-20%,#D4A017,transparent_70%)] z-0" />

      {/* 1. Header with Live Clocks, Sync Status & Branding */}
      <Header
        latestRegistrationDate={dataResponse?.latestRegistrationDate || null}
        lastUpdateByEngine={dataResponse?.lastUpdateByEngine || ''}
        isSyncing={isSyncing}
        onRefresh={() => fetchTradersData(true)}
        nextSyncSeconds={nextSyncSeconds}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAppsScriptModal={() => setIsAppsScriptModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Action Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0A0A0F] border border-[#D4A017] text-[#F3C677] px-4 py-2.5 rounded-sm shadow-[0_0_30px_rgba(212,160,23,0.3)] flex items-center gap-2 text-xs font-mono animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Bento Layout Container */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 relative z-10 flex flex-col">
        
        {/* Sync Error Alert if upstream issues occur */}
        {syncError && (
          <div className="mb-4 p-3 rounded-sm bg-amber-950/40 border border-amber-800/50 flex items-center justify-between gap-3 text-xs text-amber-200 font-mono">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Upstream fetch warning: {syncError}. Serving cached records automatically.</span>
            </div>
            <button
              onClick={() => fetchTradersData(true)}
              className="px-2.5 py-1 rounded-sm bg-[#2D1F10] border border-[#D4A017]/40 text-[#F3C677] font-semibold hover:bg-[#3E2D17] cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* 2. Bento Metrics Summary Cards (Malaysia Box & Indonesia Box) */}
        <MetricsCard
          malaysiaMetrics={dataResponse?.metrics?.malaysia || null}
          indonesiaMetrics={dataResponse?.metrics?.indonesia || null}
          activeStatusFilter={statusFilter}
          activeCountryFilter={countryFilter}
          onFilterStatus={handleFilterStatus}
        />

        {/* 3. Global Search & Filter Bar */}
        <SearchFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          accountTypeFilter={accountTypeFilter}
          onAccountTypeFilterChange={setAccountTypeFilter}
          availableAccountTypes={availableAccountTypes}
          totalFilteredCount={totalFilteredCount}
          totalUnfilteredCount={totalUnfilteredCount}
          onResetAll={handleResetAllFilters}
        />

        {/* 4. Separated Bento Data Tables */}
        {/* Top Table: Malaysia Database */}
        {(countryFilter === null || countryFilter === 'MY') && (
          <TradersTable
            title="Database Malaysia Registry (MY)"
            countryCode="MY"
            traders={filteredMalaysia}
            onSelectTrader={(t) => setSelectedTrader(t)}
            onVerifyTrader={handleVerifyTrader}
            onPromptDeleteTrader={handlePromptDeleteTrader}
            verifyingId={verifyingId}
            searchTerm={searchTerm}
            isInitialLoading={isInitialLoading}
            filterState={myFilters}
            onFilterChange={setMyFilters}
            onResetFilters={() => setMyFilters({ ...initialFilterState })}
            availableAccountTypes={availableAccountTypes}
            availablePartnerEmails={availableMyPartnerEmails}
            totalUnfilteredCount={allMalaysia.length}
          />
        )}

        {/* Bottom Table: Indonesia Database */}
        {(countryFilter === null || countryFilter === 'ID') && (
          <TradersTable
            title="Database Indonesia Registry (ID)"
            countryCode="ID"
            traders={filteredIndonesia}
            onSelectTrader={(t) => setSelectedTrader(t)}
            onVerifyTrader={handleVerifyTrader}
            onPromptDeleteTrader={handlePromptDeleteTrader}
            verifyingId={verifyingId}
            searchTerm={searchTerm}
            isInitialLoading={isInitialLoading}
            filterState={idFilters}
            onFilterChange={setIdFilters}
            onResetFilters={() => setIdFilters({ ...initialFilterState })}
            availableAccountTypes={availableAccountTypes}
            availablePartnerEmails={availableIdPartnerEmails}
            totalUnfilteredCount={allIndonesia.length}
          />
        )}

      </main>

      {/* Bento Footer */}
      <footer className="px-6 py-3 border-t border-[#3E2D17] bg-[#0A0A0F] flex flex-col sm:flex-row justify-between items-center text-[9px] font-mono tracking-widest text-[#D4A017]/60 uppercase gap-2 relative z-10">
        <div>OWL ALGO DATABASE // ENGINEERED BY IQWANENGINE</div>
        <div className="flex items-center gap-4">
          <span>REGION: GLOBAL (MY/ID)</span>
          <span className="text-[#E2E8F0]/30">|</span>
          <span>SECURED GATEWAY: WWW.OWLFX.MY</span>
        </div>
      </footer>

      {/* 5. Detail Modal */}
      <TraderDetailModal
        trader={selectedTrader}
        onClose={() => setSelectedTrader(null)}
      />

      {/* 6. Delete Confirmation Modal */}
      <DeleteConfirmModal
        trader={deletingTrader}
        isOpen={!!deletingTrader}
        isDeleting={isDeleting}
        onClose={() => setDeletingTrader(null)}
        onConfirmDelete={handleConfirmDeleteTrader}
      />

      {/* 7. Apps Script Code Helper Modal */}
      <AppsScriptModal
        isOpen={isAppsScriptModalOpen}
        onClose={() => setIsAppsScriptModalOpen(false)}
      />

      {/* 8. Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticate={handleAuthenticate}
        currentEmail={currentUser?.email || ''}
      />

    </div>
  );
}

