/* Powered by IqwanEngine */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TraderRecord, 
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
import { calculateMetrics, formatLiveTimestamp } from './utils/formatters';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const SYNC_INTERVAL_SECONDS = 15;

export default function App() {
  // 1. Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('owlalgo_user_email');
      const isConsensusAuth = localStorage.getItem('owlfx_auth_session') === 'authenticated';
      
      if (!saved && !isConsensusAuth) return null;
      
      const email = saved || 'admin_session@owlfx.my';
      return {
        email: email,
        name: (email.split('@')[0] || 'ADMIN').toUpperCase(),
        isAuthorized: isConsensusAuth, 
        role: isConsensusAuth ? 'Administrator' : 'Guest'
      };
    } catch (e) {
      return null;
    }
  });

  const checkAuth = useCallback(async (email: string) => {
    if (!email) return;
    try {
      const res = await fetch(`/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error('Auth fetch failed');
      const data = await res.json();
      
      const isConsensusAuth = localStorage.getItem('owlfx_auth_session') === 'authenticated';

      if (data && data.success) {
        setCurrentUser(data.user);
      } else if (isConsensusAuth) {
        setCurrentUser({
          email,
          name: (email.split('@')[0] || 'ADMIN').toUpperCase(),
          isAuthorized: true,
          role: 'Administrator'
        });
      } else {
        setCurrentUser({
          email,
          name: (email.split('@')[0] || 'GUEST').toUpperCase(),
          isAuthorized: false,
          role: 'Unauthorized User'
        });
      }
    } catch (err) {
      const isConsensusAuth = localStorage.getItem('owlfx_auth_session') === 'authenticated';
      if (isConsensusAuth) {
        setCurrentUser({
          email,
          name: (email.split('@')[0] || 'ADMIN').toUpperCase(),
          isAuthorized: true,
          role: 'Administrator'
        });
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email) {
      checkAuth(currentUser.email);
    }
  }, [checkAuth, currentUser?.email]);

  // Synchronize route URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath === '/' || currentPath === '') {
        window.history.replaceState(null, '', '/owlalgo-access-secured');
      }
    }
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAppsScriptModalOpen, setIsAppsScriptModalOpen] = useState<boolean>(false);

  // 2. Traders Data State
  const [malaysiaData, setMalaysiaData] = useState<TraderRecord[]>([]);
  const [indonesiaData, setIndonesiaData] = useState<TraderRecord[]>([]);
  const [malaysiaMetrics, setMalaysiaMetrics] = useState<CountryMetrics | null>(null);
  const [indonesiaMetrics, setIndonesiaMetrics] = useState<CountryMetrics | null>(null);
  const [latestRegistrationDate, setLatestRegistrationDate] = useState<string | null>(null);
  
  const [loadingMY, setLoadingMY] = useState<boolean>(true);
  const [loadingID, setLoadingID] = useState<boolean>(true);
  
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nextSyncSeconds, setNextSyncSeconds] = useState<number>(SYNC_INTERVAL_SECONDS);

  // 3. Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<'MY' | 'ID' | null>(null);
  const [accountTypeFilter, setAccountTypeFilter] = useState<string | null>(null);

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

  // 4. UI Actions
  const [selectedTrader, setSelectedTrader] = useState<TraderRecord | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingTrader, setDeletingTrader] = useState<TraderRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const fetchTradersData = useCallback(async (isManualRefresh = false) => {
    setIsSyncing(true);
    setSyncError(null);

    const fetchRegion = async (region: 'MY' | 'ID') => {
      if (region === 'MY') setLoadingMY(true);
      else setLoadingID(true);

      try {
        const url = `/api/traders?region=${region}${isManualRefresh ? '&fresh=true' : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const json = await res.json();
        if (json && json.success) {
          const traders = region === 'MY' ? (json.data?.malaysia || []) : (json.data?.indonesia || []);
          const metrics = calculateMetrics(traders, region);

          if (region === 'MY') {
            setMalaysiaData(Array.isArray(traders) ? traders : []);
            setMalaysiaMetrics(metrics);
          } else {
            setIndonesiaData(Array.isArray(traders) ? traders : []);
            setIndonesiaMetrics(metrics);
          }
        }
      } catch (err: any) {
        setSyncError(`Upstream ${region} fetch issue: ${err.message}`);
      } finally {
        if (region === 'MY') setLoadingMY(false);
        else setLoadingID(false);
      }
    };

    fetchRegion('MY');
    fetchRegion('ID');

    setIsSyncing(false);
    setNextSyncSeconds(SYNC_INTERVAL_SECONDS);
  }, []);

  useEffect(() => {
    const allTraders = [...(malaysiaData || []), ...(indonesiaData || [])];
    const allDates = allTraders
      .map(t => t?.registerDate)
      .filter(Boolean)
      .map(d => new Date(d))
      .filter(d => d && !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    if (allDates.length > 0) {
      setLatestRegistrationDate(allDates[0].toLocaleString('en-GB', { 
        timeZone: 'Asia/Kuala_Lumpur', 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) + ' (MYT)');
    }
  }, [malaysiaData, indonesiaData]);

  useEffect(() => {
    fetchTradersData();
  }, [fetchTradersData]);

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

  const handleVerifyTrader = async (trader: TraderRecord) => {
    if (!trader) return;
    setVerifyingId(trader.id);

    const now = new Date();
    const currentTimestamp = now.toLocaleString('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    if (trader.country === 'MY') {
      setMalaysiaData(prev => (prev || []).map(t => t.id === trader.id ? { ...t, lastUpdateFormatted: currentTimestamp } : t));
    } else {
      setIndonesiaData(prev => (prev || []).map(t => t.id === trader.id ? { ...t, lastUpdateFormatted: currentTimestamp } : t));
    }

    try {
      const res = await fetch('/api/traders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_col_w',
          region: trader.country,
          row_index: trader.rowIndex,
          valetax_id: trader.valetaxId,
          timestamp: currentTimestamp
        })
      });

      if (!res.ok) throw new Error('Server update failed');
      showToast(`✓ Sync Success: Row #${trader.rowIndex} Column W updated to ${currentTimestamp}`);
    } catch (err: any) {
      showToast(`Notice: Local review updated.`);
    } finally {
      setVerifyingId(null);
    }
  };

  const handlePromptDeleteTrader = (trader: TraderRecord) => {
    setSelectedTrader(null);
    setDeletingTrader(trader);
  };

  const handleConfirmDeleteTrader = async () => {
    if (!deletingTrader) return;
    setIsDeleting(true);
    const target = deletingTrader;

    if (target.country === 'MY') {
      setMalaysiaData(prev => (prev || []).filter(t => t.id !== target.id));
    } else {
      setIndonesiaData(prev => (prev || []).filter(t => t.id !== target.id));
    }

    try {
      const res = await fetch('/api/traders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_trader',
          country: target.country,
          rowIndex: target.rowIndex,
          valetax_id: target.valetaxId
        })
      });

      if (!res.ok) throw new Error(`Delete failed`);
      showToast(`✕ Record Row #${target.rowIndex} (${target.traderName}) removed`);
    } catch (err: any) {
      showToast(`Notice: Record removed locally.`);
    } finally {
      setIsDeleting(false);
      setDeletingTrader(null);
    }
  };

  const handleAuthenticate = async (email: string, secondaryEmail?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, secondaryEmail })
      });
      const data = await res.json();
      const isConsensusAuth = localStorage.getItem('owlfx_auth_session') === 'authenticated';
      
      if ((data && data.success) || isConsensusAuth) {
        localStorage.setItem('owlalgo_user_email', email);
        const authUser: AuthUser = (data && data.success) ? data.user : {
          email,
          name: (email.split('@')[0] || 'ADMIN').toUpperCase(),
          isAuthorized: true,
          role: 'Administrator'
        };
        setCurrentUser(authUser);
        return true;
      }
      return false;
    } catch (e) {
      const isConsensusAuth = localStorage.getItem('owlfx_auth_session') === 'authenticated';
      if (isConsensusAuth) {
        localStorage.setItem('owlalgo_user_email', email);
        setCurrentUser({
          email,
          name: (email.split('@')[0] || 'ADMIN').toUpperCase(),
          isAuthorized: true,
          role: 'Administrator'
        });
        return true;
      }
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('owlalgo_user_email');
    localStorage.removeItem('owlfx_auth_session');
    setCurrentUser(null);
    setMalaysiaData([]);
    setIndonesiaData([]);
    setMalaysiaMetrics(null);
    setIndonesiaMetrics(null);
  };

  const handleQuickAuthorize = (email: string) => {
    handleAuthenticate(email);
  };

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

  const availableAccountTypes = useMemo(() => {
    const set = new Set<string>();
    [...(malaysiaData || []), ...(indonesiaData || [])].forEach(t => {
      if (t && t.accountType && t.accountType !== '-') set.add(t.accountType);
    });
    return Array.from(set).sort();
  }, [malaysiaData, indonesiaData]);

  const availableMyPartnerEmails = useMemo(() => {
    const set = new Set<string>();
    (malaysiaData || []).forEach(t => {
      if (t && t.directPartnerEmail && t.directPartnerEmail !== '-' && t.directPartnerEmail.trim() !== '') {
        set.add(t.directPartnerEmail.trim().toLowerCase());
      }
    });
    return Array.from(set).sort();
  }, [malaysiaData]);

  const availableIdPartnerEmails = useMemo(() => {
    const set = new Set<string>();
    (indonesiaData || []).forEach(t => {
      if (t && t.directPartnerEmail && t.directPartnerEmail !== '-' && t.directPartnerEmail.trim() !== '') {
        set.add(t.directPartnerEmail.trim().toLowerCase());
      }
    });
    return Array.from(set).sort();
  }, [indonesiaData]);

  const evaluateMultiColumnFilter = (t: TraderRecord, filterState: MultiColumnFilterState): boolean => {
    if (!t) return false;
    if (filterState.dateFrom || filterState.dateTo) {
      if (!t.registerDate) return false;
      const d = new Date(t.registerDate);
      if (isNaN(d.getTime())) return false;
      const traderDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (filterState.dateFrom && traderDateStr < filterState.dateFrom) return false;
      if (filterState.dateTo && traderDateStr > filterState.dateTo) return false;
    }
    const minVal = filterState.minBalance !== '' ? parseFloat(filterState.minBalance) : null;
    const maxVal = filterState.maxBalance !== '' ? parseFloat(filterState.maxBalance) : null;
    if (minVal !== null && !isNaN(minVal) && (t.balance || 0) < minVal) return false;
    if (maxVal !== null && !isNaN(maxVal) && (t.balance || 0) > maxVal) return false;
    if (filterState.accountType && (t.accountType || '').toLowerCase() !== filterState.accountType.toLowerCase()) return false;
    if (filterState.partnerEmail && !(t.directPartnerEmail || '').toLowerCase().includes(filterState.partnerEmail.toLowerCase().trim())) return false;
    
    if (filterState.status) {
      const s = (t.status || '').toUpperCase().trim();
      const f = filterState.status.toUpperCase().trim();
      if (f === 'ACTIVE') { if (s !== 'ACTIVE' && s !== 'VALID' && !s.includes('VIP')) return false; }
      else if (f === 'LOW BAL') { if (!s.includes('LOW')) return false; }
      else if (f === 'MC') { if (!s.includes('MC')) return false; }
      else if (f === 'NOT VALID') { if (!s.includes('NOT')) return false; }
      else if (f === 'VALID VIP') { if (!s.includes('VALID VIP') || s.includes('INDICATOR')) return false; }
    }
    return true;
  };

  const filterGlobalTrader = useCallback((t: TraderRecord): boolean => {
    if (!t) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchName = (t.traderName || '').toLowerCase().includes(q);
      const matchContact = (t.contactNumber || '').toLowerCase().includes(q);
      const matchEmail = (t.registerEmail || '').toLowerCase().includes(q);
      const matchValetax = (t.valetaxId || '').toLowerCase().includes(q);
      if (!matchName && !matchContact && !matchEmail && !matchValetax) return false;
    }
    if (statusFilter) {
      const s = (t.status || '').toUpperCase().trim();
      const f = statusFilter.toUpperCase().trim();
      if (f === 'ACTIVE') { if (s !== 'ACTIVE' && s !== 'VALID' && !s.includes('VIP')) return false; }
      else if (f === 'LOW BAL') { if (!s.includes('LOW')) return false; }
      else if (f === 'MC') { if (!s.includes('MC')) return false; }
    }
    if (accountTypeFilter && t.accountType !== accountTypeFilter) return false;
    return true;
  }, [searchTerm, statusFilter, accountTypeFilter]);

  const filteredMalaysia = useMemo(() => {
    if (countryFilter === 'ID') return [];
    return (malaysiaData || []).filter(t => filterGlobalTrader(t) && evaluateMultiColumnFilter(t, myFilters));
  }, [malaysiaData, filterGlobalTrader, countryFilter, myFilters]);

  const filteredIndonesia = useMemo(() => {
    if (countryFilter === 'MY') return [];
    return (indonesiaData || []).filter(t => filterGlobalTrader(t) && evaluateMultiColumnFilter(t, idFilters));
  }, [indonesiaData, filterGlobalTrader, countryFilter, idFilters]);

  const totalFiltered = useMemo(() => filteredMalaysia.length + filteredIndonesia.length, [filteredMalaysia, filteredIndonesia]);
  const totalUnfiltered = useMemo(() => malaysiaData.length + indonesiaData.length, [malaysiaData, indonesiaData]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <AuthModal isOpen={true} onClose={() => {}} onAuthenticate={handleAuthenticate} currentEmail="" />
      </div>
    );
  }

  if (currentUser && !currentUser.isAuthorized) {
    return (
      <>
        <AccessDenied403 unauthorizedEmail={currentUser.email} onOpenAuthModal={() => setIsAuthModalOpen(true)} onQuickAuthorize={handleQuickAuthorize} />
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onAuthenticate={handleAuthenticate} currentEmail={currentUser.email} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#E2E8F0] selection:bg-[#D4A017] selection:text-black flex flex-col relative font-sans">
      <div className="fixed inset-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_50%_-20%,#D4A017,transparent_70%)] z-0" />
      <Header
        latestRegistrationDate={latestRegistrationDate}
        lastUpdateByEngine={formatLiveTimestamp()}
        isSyncing={isSyncing}
        onRefresh={() => fetchTradersData(true)}
        nextSyncSeconds={nextSyncSeconds}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAppsScriptModal={() => setIsAppsScriptModalOpen(true)}
        onLogout={handleLogout}
      />
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0A0A0F] border border-[#D4A017] text-[#F3C677] px-4 py-2.5 rounded-sm shadow-[0_0_30px_rgba(212,160,23,0.3)] flex items-center gap-2 text-xs font-mono animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 relative z-10 flex flex-col">
        {syncError && (
          <div className="mb-4 p-3 rounded-sm bg-amber-950/40 border border-amber-800/50 flex items-center justify-between gap-3 text-xs text-amber-200 font-mono">
            <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" /><span>{syncError}</span></div>
            <button onClick={() => fetchTradersData(true)} className="px-2.5 py-1 rounded-sm bg-[#2D1F10] border border-[#D4A017]/40 text-[#F3C677] font-semibold hover:bg-[#3E2D17] cursor-pointer">Retry Sync</button>
          </div>
        )}
        <MetricsCard malaysiaMetrics={malaysiaMetrics} indonesiaMetrics={indonesiaMetrics} activeStatusFilter={statusFilter} activeCountryFilter={countryFilter} onFilterStatus={handleFilterStatus} />
        
        <SearchFilter 
          searchTerm={searchTerm} 
          onSearchChange={setSearchTerm} 
          statusFilter={statusFilter} 
          onStatusFilterChange={setStatusFilter} 
          accountTypeFilter={accountTypeFilter}
          onAccountTypeFilterChange={setAccountTypeFilter}
          availableAccountTypes={availableAccountTypes}
          totalFilteredCount={totalFiltered} 
          totalUnfilteredCount={totalUnfiltered} 
          onResetAll={handleResetAllFilters}
        />

        <div className="space-y-8">
          <TradersTable traders={filteredMalaysia} countryCode="MY" isInitialLoading={loadingMY} totalUnfilteredCount={malaysiaData.length} verifyingId={verifyingId} onVerifyTrader={handleVerifyTrader} onSelectTrader={setSelectedTrader} onPromptDeleteTrader={handlePromptDeleteTrader} filterState={myFilters} onFilterChange={setMyFilters} onResetFilters={() => setMyFilters({ ...initialFilterState })} availableAccountTypes={availableAccountTypes} availablePartnerEmails={availableMyPartnerEmails} />
          <TradersTable traders={filteredIndonesia} countryCode="ID" isInitialLoading={loadingID} totalUnfilteredCount={indonesiaData.length} verifyingId={verifyingId} onVerifyTrader={handleVerifyTrader} onSelectTrader={setSelectedTrader} onPromptDeleteTrader={handlePromptDeleteTrader} filterState={idFilters} onFilterChange={setIdFilters} onResetFilters={() => setIdFilters({ ...initialFilterState })} availableAccountTypes={availableAccountTypes} availablePartnerEmails={availableIdPartnerEmails} />
        </div>
      </main>
      <footer className="px-6 py-3 border-t border-[#3E2D17] bg-[#0A0A0F] flex flex-col sm:flex-row justify-between items-center text-[9px] font-mono tracking-widest text-[#D4A017]/60 uppercase gap-2 relative z-10">
        <div>OWL ALGO DATABASE // ENGINEERED BY IQWANENGINE</div>
        <div className="flex items-center gap-4"><span>REGION: GLOBAL (MY/ID)</span><span className="text-[#E2E8F0]/30">|</span><span>SECURED GATEWAY: WWW.OWLFX.MY</span></div>
      </footer>
      <TraderDetailModal trader={selectedTrader} onClose={() => setSelectedTrader(null)} />
      <DeleteConfirmModal trader={deletingTrader} isOpen={!!deletingTrader} isDeleting={isDeleting} onClose={() => setDeletingTrader(null)} onConfirmDelete={handleConfirmDeleteTrader} />
      <AppsScriptModal isOpen={isAppsScriptModalOpen} onClose={() => setIsAppsScriptModalOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onAuthenticate={handleAuthenticate} currentEmail={currentUser?.email || ''} />
    </div>
  );
}
