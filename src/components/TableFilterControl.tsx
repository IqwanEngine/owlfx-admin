/* Powered by IqwanEngine */

import React, { useState, useMemo } from 'react';
import { 
  Filter, 
  RotateCcw, 
  Calendar, 
  DollarSign, 
  UserCheck, 
  Mail, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Check, 
  X,
  SlidersHorizontal
} from 'lucide-react';
import { MultiColumnFilterState, DatePreset, BalancePreset } from '../types';

interface TableFilterControlProps {
  countryCode: 'MY' | 'ID';
  filterState: MultiColumnFilterState;
  onFilterChange: (newState: MultiColumnFilterState) => void;
  onResetFilters: () => void;
  availableAccountTypes: string[];
  availablePartnerEmails: string[];
  totalFilteredCount: number;
  totalUnfilteredCount: number;
}

export const TableFilterControl: React.FC<TableFilterControlProps> = ({
  countryCode,
  filterState,
  onFilterChange,
  onResetFilters,
  availableAccountTypes,
  availablePartnerEmails,
  totalFilteredCount,
  totalUnfilteredCount
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [partnerSearchTerm, setPartnerSearchTerm] = useState<string>('');
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState<boolean>(false);

  // Check if any filter in this control is active
  const isFilterActive = useMemo(() => {
    return (
      filterState.datePreset !== 'all' ||
      Boolean(filterState.dateFrom) ||
      Boolean(filterState.dateTo) ||
      filterState.balancePreset !== 'all' ||
      Boolean(filterState.minBalance) ||
      Boolean(filterState.maxBalance) ||
      Boolean(filterState.accountType) ||
      Boolean(filterState.partnerEmail) ||
      Boolean(filterState.status)
    );
  }, [filterState]);

  // Count number of active filter dimensions
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterState.datePreset !== 'all' || filterState.dateFrom || filterState.dateTo) count++;
    if (filterState.balancePreset !== 'all' || filterState.minBalance || filterState.maxBalance) count++;
    if (filterState.accountType) count++;
    if (filterState.partnerEmail) count++;
    if (filterState.status) count++;
    return count;
  }, [filterState]);

  // Date Preset Change Handler
  const handleDatePresetChange = (preset: DatePreset) => {
    const today = new Date();
    // Helper for formatting YYYY-MM-DD
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'all') {
      onFilterChange({
        ...filterState,
        datePreset: 'all',
        dateFrom: '',
        dateTo: ''
      });
    } else if (preset === 'today') {
      const dStr = formatDate(today);
      onFilterChange({
        ...filterState,
        datePreset: 'today',
        dateFrom: dStr,
        dateTo: dStr
      });
    } else if (preset === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const dStr = formatDate(yesterday);
      onFilterChange({
        ...filterState,
        datePreset: 'yesterday',
        dateFrom: dStr,
        dateTo: dStr
      });
    } else if (preset === 'last7days') {
      const past7 = new Date(today);
      past7.setDate(today.getDate() - 7);
      onFilterChange({
        ...filterState,
        datePreset: 'last7days',
        dateFrom: formatDate(past7),
        dateTo: formatDate(today)
      });
    } else if (preset === 'thismonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      onFilterChange({
        ...filterState,
        datePreset: 'thismonth',
        dateFrom: formatDate(firstDay),
        dateTo: formatDate(today)
      });
    } else {
      onFilterChange({
        ...filterState,
        datePreset: 'custom'
      });
    }
  };

  // Balance Preset Change Handler
  const handleBalancePresetChange = (preset: BalancePreset) => {
    if (preset === 'all') {
      onFilterChange({
        ...filterState,
        balancePreset: 'all',
        minBalance: '',
        maxBalance: ''
      });
    } else if (preset === 'zero_mc') {
      onFilterChange({
        ...filterState,
        balancePreset: 'zero_mc',
        minBalance: '0',
        maxBalance: '0'
      });
    } else if (preset === 'under_30') {
      onFilterChange({
        ...filterState,
        balancePreset: 'under_30',
        minBalance: '0',
        maxBalance: '29.99'
      });
    } else if (preset === '30_to_99') {
      onFilterChange({
        ...filterState,
        balancePreset: '30_to_99',
        minBalance: '30',
        maxBalance: '99.99'
      });
    } else if (preset === '100_plus') {
      onFilterChange({
        ...filterState,
        balancePreset: '100_plus',
        minBalance: '100',
        maxBalance: ''
      });
    } else {
      onFilterChange({
        ...filterState,
        balancePreset: 'custom'
      });
    }
  };

  // Filtered list of partner emails for searchable dropdown
  const filteredPartnerEmails = useMemo(() => {
    if (!partnerSearchTerm.trim()) return availablePartnerEmails;
    return availablePartnerEmails.filter(email => 
      email.toLowerCase().includes(partnerSearchTerm.toLowerCase().trim())
    );
  }, [availablePartnerEmails, partnerSearchTerm]);

  return (
    <div className="bg-[#0D0B09] border-b border-[#3E2D17] font-mono text-[10px]">
      
      {/* 1. Header Bar for Collapsible Filter Control */}
      <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 bg-[#120F0C]">
        
        {/* Left: Filter Toggle Button & Active Status */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-2.5 py-1 rounded-xs flex items-center gap-1.5 font-bold uppercase transition-all cursor-pointer border ${
              isFilterActive 
                ? 'bg-[#D4A017] text-black border-[#D4A017]' 
                : 'bg-[#18130B] text-[#D4A017] border-[#3E2D17] hover:border-[#D4A017]/60'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3 stroke-[2.5]" />
            <span>Dynamic Multi-Column Filters</span>
            {activeFiltersCount > 0 && (
              <span className="px-1 py-0.2 bg-black text-[#D4A017] rounded-full text-[8px] font-extrabold ml-0.5">
                {activeFiltersCount}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 ml-0.5" />
            ) : (
              <ChevronDown className="w-3 h-3 ml-0.5" />
            )}
          </button>

          {/* Quick Active Filter Badges */}
          <div className="hidden lg:flex items-center gap-1.5 text-[9px] text-[#A1A1AA]">
            {filterState.datePreset !== 'all' && (
              <span className="bg-[#2A1D0E] border border-[#D4A017]/40 text-[#F3C677] px-2 py-0.5 rounded-xs flex items-center gap-1">
                Date: {filterState.datePreset.toUpperCase()}
              </span>
            )}
            {filterState.balancePreset !== 'all' && (
              <span className="bg-[#2A1D0E] border border-[#D4A017]/40 text-emerald-300 px-2 py-0.5 rounded-xs flex items-center gap-1">
                Bal: {filterState.balancePreset.replace('_', ' ').toUpperCase()}
              </span>
            )}
            {filterState.accountType && (
              <span className="bg-[#2A1D0E] border border-[#D4A017]/40 text-[#D4A017] px-2 py-0.5 rounded-xs flex items-center gap-1">
                Type: {filterState.accountType}
              </span>
            )}
            {filterState.partnerEmail && (
              <span className="bg-[#2A1D0E] border border-[#D4A017]/40 text-blue-300 px-2 py-0.5 rounded-xs flex items-center gap-1 max-w-[150px] truncate" title={filterState.partnerEmail}>
                Partner: {filterState.partnerEmail}
              </span>
            )}
            {filterState.status && (
              <span className="bg-[#2A1D0E] border border-[#D4A017]/40 text-[#F3C677] px-2 py-0.5 rounded-xs flex items-center gap-1">
                Status: {filterState.status}
              </span>
            )}
          </div>
        </div>

        {/* Right: Record count & Reset Filter Button */}
        <div className="flex items-center gap-2">
          <div className="text-[9px] text-[#71717A]">
            FILTERED: <span className="text-[#D4A017] font-bold">{totalFilteredCount}</span> / {totalUnfilteredCount}
          </div>

          {isFilterActive && (
            <button
              onClick={onResetFilters}
              title="Reset all table filters to default"
              className="px-2 py-1 bg-[#231210] hover:bg-rose-950 border border-rose-800/60 text-rose-300 hover:text-rose-200 rounded-xs flex items-center gap-1 uppercase font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

      </div>

      {/* 2. Collapsible Filter Control Form Panel */}
      {isExpanded && (
        <div className="p-3.5 bg-[#080706] border-t border-[#3E2D17]/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-in fade-in duration-150">
          
          {/* COLUMN 1: Register Date Filter */}
          <div className="bg-[#0E0C09] border border-[#3E2D17] rounded-xs p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[#D4A017] font-bold uppercase tracking-wider text-[9px] border-b border-[#3E2D17]/50 pb-1">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#D4A017]" />
                <span>Register Date</span>
              </div>
              {filterState.datePreset !== 'all' && (
                <button 
                  onClick={() => handleDatePresetChange('all')}
                  className="text-zinc-500 hover:text-white"
                  title="Clear Date Filter"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Date Presets Dropdown */}
            <select
              value={filterState.datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
              className="w-full bg-[#050505] border border-[#3E2D17] text-white py-1 px-2 rounded-xs focus:outline-none focus:border-[#D4A017] uppercase"
            >
              <option value="all">Preset: All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="thismonth">This Month</option>
              <option value="custom">Custom Date Range...</option>
            </select>

            {/* Custom Date Range Inputs */}
            <div className="grid grid-cols-2 gap-1.5 mt-0.5">
              <div>
                <span className="text-[8px] text-[#71717A] uppercase block">From Date</span>
                <input
                  type="date"
                  value={filterState.dateFrom}
                  onChange={(e) => {
                    onFilterChange({
                      ...filterState,
                      datePreset: 'custom',
                      dateFrom: e.target.value
                    });
                  }}
                  className="w-full bg-[#050505] border border-[#3E2D17] text-white text-[9px] py-1 px-1.5 rounded-xs focus:outline-none focus:border-[#D4A017]"
                />
              </div>
              <div>
                <span className="text-[8px] text-[#71717A] uppercase block">To Date</span>
                <input
                  type="date"
                  value={filterState.dateTo}
                  onChange={(e) => {
                    onFilterChange({
                      ...filterState,
                      datePreset: 'custom',
                      dateTo: e.target.value
                    });
                  }}
                  className="w-full bg-[#050505] border border-[#3E2D17] text-white text-[9px] py-1 px-1.5 rounded-xs focus:outline-none focus:border-[#D4A017]"
                />
              </div>
            </div>
          </div>

          {/* COLUMN 2: Balance Range Filter */}
          <div className="bg-[#0E0C09] border border-[#3E2D17] rounded-xs p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[#D4A017] font-bold uppercase tracking-wider text-[9px] border-b border-[#3E2D17]/50 pb-1">
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span>Balance (USD)</span>
              </div>
              {filterState.balancePreset !== 'all' && (
                <button 
                  onClick={() => handleBalancePresetChange('all')}
                  className="text-zinc-500 hover:text-white"
                  title="Clear Balance Filter"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Balance Presets Dropdown */}
            <select
              value={filterState.balancePreset}
              onChange={(e) => handleBalancePresetChange(e.target.value as BalancePreset)}
              className="w-full bg-[#050505] border border-[#3E2D17] text-white py-1 px-2 rounded-xs focus:outline-none focus:border-[#D4A017] uppercase"
            >
              <option value="all">Preset: All Balances</option>
              <option value="zero_mc">$0 / Margin Call (MC)</option>
              <option value="under_30">&lt; $30.00 (Low Bal)</option>
              <option value="30_to_99">$30.00 - $99.99</option>
              <option value="100_plus">&gt;= $100.00 (VIP Target)</option>
              <option value="custom">Custom Range ($ Min - Max)...</option>
            </select>

            {/* Min & Max Inputs */}
            <div className="grid grid-cols-2 gap-1.5 mt-0.5">
              <div>
                <span className="text-[8px] text-[#71717A] uppercase block">$ Min</span>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={filterState.minBalance}
                  onChange={(e) => {
                    onFilterChange({
                      ...filterState,
                      balancePreset: 'custom',
                      minBalance: e.target.value
                    });
                  }}
                  className="w-full bg-[#050505] border border-[#3E2D17] text-emerald-400 text-[9px] py-1 px-1.5 rounded-xs focus:outline-none focus:border-[#D4A017] font-bold"
                />
              </div>
              <div>
                <span className="text-[8px] text-[#71717A] uppercase block">$ Max</span>
                <input
                  type="number"
                  step="any"
                  placeholder="Max"
                  value={filterState.maxBalance}
                  onChange={(e) => {
                    onFilterChange({
                      ...filterState,
                      balancePreset: 'custom',
                      maxBalance: e.target.value
                    });
                  }}
                  className="w-full bg-[#050505] border border-[#3E2D17] text-emerald-400 text-[9px] py-1 px-1.5 rounded-xs focus:outline-none focus:border-[#D4A017] font-bold"
                />
              </div>
            </div>
          </div>

          {/* COLUMN 3: Account Type Filter */}
          <div className="bg-[#0E0C09] border border-[#3E2D17] rounded-xs p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[#D4A017] font-bold uppercase tracking-wider text-[9px] border-b border-[#3E2D17]/50 pb-1">
              <div className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#D4A017]" />
                <span>Account Type</span>
              </div>
              {filterState.accountType && (
                <button 
                  onClick={() => onFilterChange({ ...filterState, accountType: '' })}
                  className="text-zinc-500 hover:text-white"
                  title="Clear Account Type"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            <select
              value={filterState.accountType}
              onChange={(e) => onFilterChange({ ...filterState, accountType: e.target.value })}
              className="w-full bg-[#050505] border border-[#3E2D17] text-white py-1 px-2 rounded-xs focus:outline-none focus:border-[#D4A017] uppercase mt-1"
            >
              <option value="">TYPE: ALL TYPES</option>
              {availableAccountTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <span className="text-[8px] text-[#71717A] mt-auto">
              Dynamically derived from {countryCode} records.
            </span>
          </div>

          {/* COLUMN 4: Partner / IB Email Filter */}
          <div className="bg-[#0E0C09] border border-[#3E2D17] rounded-xs p-2.5 flex flex-col gap-2 relative">
            <div className="flex items-center justify-between text-[#D4A017] font-bold uppercase tracking-wider text-[9px] border-b border-[#3E2D17]/50 pb-1">
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-blue-400" />
                <span>Partner / IB Email</span>
              </div>
              {filterState.partnerEmail && (
                <button 
                  onClick={() => {
                    onFilterChange({ ...filterState, partnerEmail: '' });
                    setPartnerSearchTerm('');
                  }}
                  className="text-zinc-500 hover:text-white"
                  title="Clear Partner Filter"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Searchable input / selector */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search or Select IB..."
                value={filterState.partnerEmail || partnerSearchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setPartnerSearchTerm(val);
                  onFilterChange({
                    ...filterState,
                    partnerEmail: val
                  });
                  setIsPartnerDropdownOpen(true);
                }}
                onFocus={() => setIsPartnerDropdownOpen(true)}
                className="w-full bg-[#050505] border border-[#3E2D17] text-white text-[9px] py-1 px-2 rounded-xs focus:outline-none focus:border-[#D4A017] lowercase"
              />
              {filterState.partnerEmail && (
                <button
                  onClick={() => {
                    onFilterChange({ ...filterState, partnerEmail: '' });
                    setPartnerSearchTerm('');
                  }}
                  className="absolute right-2 top-1.5 text-zinc-400 hover:text-white"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {/* Quick dropdown pills or suggestions */}
            {isPartnerDropdownOpen && filteredPartnerEmails.length > 0 && (
              <div 
                className="absolute top-full left-0 right-0 z-20 mt-1 max-h-36 overflow-y-auto bg-[#0A0A0F] border border-[#D4A017] rounded-xs shadow-2xl divide-y divide-[#3E2D17]/50"
                onMouseLeave={() => setIsPartnerDropdownOpen(false)}
              >
                <div 
                  onClick={() => {
                    onFilterChange({ ...filterState, partnerEmail: '' });
                    setPartnerSearchTerm('');
                    setIsPartnerDropdownOpen(false);
                  }}
                  className="px-2 py-1 hover:bg-[#D4A017]/20 text-zinc-300 hover:text-[#D4A017] cursor-pointer uppercase font-bold"
                >
                  -- ALL PARTNERS / IBS --
                </div>
                {filteredPartnerEmails.map((email) => (
                  <div
                    key={email}
                    onClick={() => {
                      onFilterChange({ ...filterState, partnerEmail: email });
                      setPartnerSearchTerm('');
                      setIsPartnerDropdownOpen(false);
                    }}
                    className="px-2 py-1 hover:bg-[#D4A017]/20 text-white cursor-pointer lowercase flex items-center justify-between"
                  >
                    <span className="truncate">{email}</span>
                    {filterState.partnerEmail === email && (
                      <Check className="w-3 h-3 text-[#D4A017] shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <span className="text-[8px] text-[#71717A] mt-auto">
              Select or type any IB email.
            </span>
          </div>

          {/* COLUMN 5: Status Filter */}
          <div className="bg-[#0E0C09] border border-[#3E2D17] rounded-xs p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[#D4A017] font-bold uppercase tracking-wider text-[9px] border-b border-[#3E2D17]/50 pb-1">
              <div className="flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#D4A017]" />
                <span>Status Category</span>
              </div>
              {filterState.status && (
                <button 
                  onClick={() => onFilterChange({ ...filterState, status: '' })}
                  className="text-zinc-500 hover:text-white"
                  title="Clear Status"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            <select
              value={filterState.status}
              onChange={(e) => onFilterChange({ ...filterState, status: e.target.value })}
              className="w-full bg-[#050505] border border-[#3E2D17] text-white py-1 px-2 rounded-xs focus:outline-none focus:border-[#D4A017] uppercase mt-1"
            >
              <option value="">STATUS: ALL CATEGORIES</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="LOW BAL">LOW BALANCE</option>
              <option value="MC">MARGIN CALL (MC)</option>
              <option value="NOT VALID">NOT VALID</option>
              <option value="VALID VIP">VALID VIP</option>
              <option value="VALID VIP INDICATOR">VALID VIP INDICATOR</option>
            </select>

            <span className="text-[8px] text-[#71717A] mt-auto">
              Filter by VIP qualification status.
            </span>
          </div>

        </div>
      )}

    </div>
  );
};
