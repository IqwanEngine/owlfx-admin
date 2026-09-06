/* Powered by IqwanEngine */

import React from 'react';
import { Search, X, Sparkles } from 'lucide-react';

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
  accountTypeFilter: string | null;
  onAccountTypeFilterChange: (type: string | null) => void;
  availableAccountTypes: string[];
  totalFilteredCount: number;
  totalUnfilteredCount: number;
  onResetAll: () => void;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  accountTypeFilter,
  onAccountTypeFilterChange,
  availableAccountTypes,
  totalFilteredCount,
  totalUnfilteredCount,
  onResetAll
}) => {
  const hasActiveFilters = Boolean(searchTerm || statusFilter || accountTypeFilter);

  return (
    <div className="flex flex-col gap-2.5 mb-4">
      {/* Main Search Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="flex-1 relative">
          <input
            id="global-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Name, Contact, Email, TradingView or Valetax ID..."
            className="w-full bg-[#0A0A0F] border border-[#3E2D17] rounded-sm py-2 pl-10 pr-10 text-sm focus:outline-none focus:border-[#D4A017] transition-colors placeholder:text-[#524128] uppercase tracking-tight text-white font-mono"
          />
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#D4A017]/60 pointer-events-none" />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#71717A] hover:text-[#F3C677] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter || ''}
            onChange={(e) => onStatusFilterChange(e.target.value || null)}
            className="bg-[#0A0A0F] border border-[#3E2D17] rounded-sm py-2 px-3 text-xs text-[#E2E8F0] focus:outline-none focus:border-[#D4A017] transition-colors cursor-pointer font-mono uppercase"
          >
            <option value="">STATUS: ALL</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="LOW BAL">LOW BAL</option>
            <option value="MC">MC</option>
            <option value="NOT VALID">NOT VALID</option>
            <option value="VALID VIP">VALID VIP</option>
            <option value="VALID VIP INDICATOR">VALID VIP INDICATOR</option>
          </select>

          {/* Account Type Filter */}
          {availableAccountTypes.length > 0 && (
            <select
              value={accountTypeFilter || ''}
              onChange={(e) => onAccountTypeFilterChange(e.target.value || null)}
              className="bg-[#0A0A0F] border border-[#3E2D17] rounded-sm py-2 px-3 text-xs text-[#E2E8F0] focus:outline-none focus:border-[#D4A017] transition-colors cursor-pointer font-mono uppercase"
            >
              <option value="">TYPE: ALL</option>
              {availableAccountTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          )}

          {/* Reset Filters / Matches */}
          {hasActiveFilters ? (
            <button
              onClick={onResetAll}
              className="bg-[#D4A017] text-black px-3 sm:px-4 py-2 text-xs font-bold tracking-widest uppercase cursor-pointer hover:bg-[#F3C677] transition-colors rounded-sm flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear ({totalFilteredCount})</span>
            </button>
          ) : (
            <div className="bg-[#0A0A0F] border border-[#3E2D17] rounded-sm px-3 py-2 text-[11px] font-mono text-[#D4A017]/80">
              MATCHES: <span className="text-white font-bold">{totalFilteredCount}</span> / {totalUnfilteredCount}
            </div>
          )}
        </div>
      </div>

      {/* Active Search Term Hint */}
      {searchTerm && (
        <div className="flex items-center gap-2 text-[10px] text-[#A1A1AA] font-mono">
          <Sparkles className="w-3 h-3 text-[#D4A017]" />
          <span>FILTERING BY: <span className="text-[#F3C677] font-bold">"{searchTerm}"</span> ACROSS ALL REGISTRY FIELDS</span>
        </div>
      )}
    </div>
  );
};
