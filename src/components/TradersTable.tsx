/* Powered by IqwanEngine */

import React, { useState } from 'react';
import { 
  Check, 
  X, 
  Copy, 
  MessageCircle, 
  Loader2, 
  AlertCircle,
} from 'lucide-react';
import { TraderRecord, MultiColumnFilterState } from '../types';
import { formatCurrency, generateWhatsAppLink } from '../utils/formatters';
import { TableFilterControl } from './TableFilterControl';

interface TradersTableProps {
  traders: TraderRecord[];
  countryCode: 'MY' | 'ID';
  isInitialLoading: boolean;
  isSyncing?: boolean;
  totalUnfilteredCount: number;
  verifyingId: string | null;
  onVerifyTrader: (trader: TraderRecord) => void;
  onSelectTrader: (trader: TraderRecord) => void;
  onPromptDeleteTrader: (trader: TraderRecord) => void;
  
  // Filtering Props
  filterState: MultiColumnFilterState;
  onFilterChange: (state: MultiColumnFilterState) => void;
  onResetFilters: () => void;
  availableAccountTypes: string[];
  availablePartnerEmails: string[];
}

const ITEMS_PER_PAGE = 40;

export const TradersTable: React.FC<TradersTableProps> = ({
  traders = [],
  countryCode,
  isInitialLoading,
  isSyncing = false,
  totalUnfilteredCount = 0,
  verifyingId,
  onVerifyTrader,
  onSelectTrader,
  onPromptDeleteTrader,
  filterState,
  onFilterChange,
  onResetFilters,
  availableAccountTypes = [],
  availablePartnerEmails = []
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const safeTraders = Array.isArray(traders) ? traders : [];
  const totalPages = Math.ceil(safeTraders.length / ITEMS_PER_PAGE) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  
  const startIndex = (validCurrentPage - 1) * ITEMS_PER_PAGE;
  const currentTraders = safeTraders.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed');
    }
  };

  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase().trim();
    let styles = "bg-slate-500/10 text-slate-400 border-slate-500/20";
    
    if (s === 'ACTIVE' || s === 'VALID') styles = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    else if (s.includes('LOW')) styles = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    else if (s.includes('MC') || s.includes('MARGIN CALL')) styles = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    else if (s.includes('VALID VIP') && !s.includes('INDICATOR')) styles = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    else if (s.includes('VIP INDICATOR')) styles = "bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/20";
    else if (s.includes('NOT') || s.includes('INVALID')) styles = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

    return (
      <span className={`px-2 py-0.5 rounded-xs border text-[8px] font-bold tracking-tighter uppercase ${styles}`}>
        {s || 'UNKNOWN'}
      </span>
    );
  };

  const regionHeading = countryCode === 'MY' ? 'Database Registry Malaysia (MY)' : 'Database Registry Indonesia (ID)';

  return (
    <div className="bg-[#0A0A0F]/60 border border-[#D4A017]/10 rounded-sm overflow-hidden backdrop-blur-sm shadow-xl">
      {/* Table Header Section */}
      <div className="p-4 border-b border-[#3E2D17] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-[#1A1208]/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isInitialLoading ? 'bg-amber-500 animate-pulse' : isSyncing ? 'bg-blue-400 animate-pulse' : 'bg-emerald-500'}`} />
          <h3 className="text-[10px] font-bold tracking-[0.2em] text-[#D4A017] uppercase">
            {regionHeading}
          </h3>
          <span className="text-[9px] text-[#E2E8F0]/40 font-mono">
            ({safeTraders.length.toLocaleString()} records)
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={handlePrevPage}
              disabled={validCurrentPage <= 1 || isInitialLoading}
              className="px-2 py-0.5 border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017] hover:text-black cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-colors rounded-xs uppercase"
            >
              &larr; PREV
            </button>
            <span className="text-white/70 font-mono">
              PAGE {String(validCurrentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            </span>
            <button
              onClick={handleNextPage}
              disabled={validCurrentPage >= totalPages || isInitialLoading}
              className="px-2 py-0.5 border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017] hover:text-black cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-colors rounded-xs uppercase"
            >
              NEXT &rarr;
            </button>
          </div>
        </div>
      </div>

      <TableFilterControl
        countryCode={countryCode}
        filterState={filterState}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
        availableAccountTypes={availableAccountTypes}
        availablePartnerEmails={availablePartnerEmails}
        totalFilteredCount={safeTraders.length}
        totalUnfilteredCount={totalUnfilteredCount}
      />

      <div className="overflow-x-auto overflow-y-auto max-h-[580px]">
        <table className="w-full text-[10px] text-left border-collapse">
          <thead className="text-[#D4A017]/70 uppercase border-b border-[#3E2D17] bg-[#050505] sticky top-0 z-10 font-mono font-semibold">
            <tr>
              <th className="py-2 px-2.5 text-center w-20">Action</th>
              <th className="py-2 px-3 min-w-[150px]">Trader Name</th>
              <th className="py-2 px-3 min-w-[120px]">Contact Number</th>
              <th className="py-2 px-3 min-w-[160px]">Register Email</th>
              <th className="py-2 px-3 min-w-[130px]">TradingView ID</th>
              <th className="py-2 px-3 min-w-[100px]">Valetax ID</th>
              <th className="py-2 px-3 min-w-[130px]">Register Date</th>
              <th className="py-2 px-3 min-w-[100px] text-right">Balance</th>
              <th className="py-2 px-3 min-w-[90px]">Account Type</th>
              <th className="py-2 px-3 min-w-[150px]">Partner Email</th>
              <th className="py-2 px-3 min-w-[110px] text-center">Status</th>
              <th className="py-2 px-3 min-w-[140px]">Last Updated (Col W)</th>
            </tr>
          </thead>

          <tbody className="font-mono divide-y divide-[#3E2D17]/30">
            {isInitialLoading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse border-b border-[#3E2D17]/20">
                  <td className="px-2 py-3 text-center"><div className="h-6 w-6 bg-[#D4A017]/5 rounded mx-auto" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-24 bg-white/5 rounded" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-20 bg-white/5 rounded" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-32 bg-white/5 rounded" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-16 bg-white/5 rounded" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-12 bg-white/5 rounded" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-20 bg-white/5 rounded" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-16 bg-white/5 rounded ml-auto" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-14 bg-white/5 rounded" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-32 bg-white/5 rounded" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-12 bg-white/5 rounded mx-auto" /></td>
                  <td className="px-3 py-3"><div className="h-3 w-24 bg-white/5 rounded" /></td>
                </tr>
              ))
            ) : safeTraders.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-10 text-center text-[#71717A]">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-5 h-5 text-[#71717A]" />
                    <p className="text-[11px] font-semibold text-[#A1A1AA]">No matching records found in this region</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentTraders.map((t) => {
                if (!t) return null;
                const isVerifyingThis = verifyingId === t.id;
                const isChecked = t.lastUpdateFormatted && t.lastUpdateFormatted !== '-' && t.lastUpdateFormatted !== '';

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTrader && onSelectTrader(t)}
                    className="border-b border-[#3E2D17]/40 hover:bg-[#D4A017]/5 transition-colors cursor-pointer group"
                  >
                    <td className="px-2 py-1.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onVerifyTrader && onVerifyTrader(t); }}
                          disabled={isVerifyingThis}
                          title={isChecked ? `Reviewed: ${t.lastUpdateFormatted}. Click to update.` : 'Update Review Time in Col W'}
                          className={`w-6 h-6 rounded-xs flex items-center justify-center transition-all cursor-pointer border ${
                            isChecked
                              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-400 hover:bg-emerald-800/80 hover:text-white'
                              : 'bg-[#0F0E0A] border-[#D4A017]/40 text-[#D4A017] hover:bg-[#D4A017] hover:text-black'
                          } disabled:opacity-50`}
                        >
                          {isVerifyingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 stroke-[2.5]" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onPromptDeleteTrader && onPromptDeleteTrader(t); }}
                          title={`Delete Record (Row #${t.rowIndex})`}
                          className="w-6 h-6 rounded-xs flex items-center justify-center bg-[#0F0E0A] border border-rose-600/40 text-rose-400 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      </div>
                    </td>

                    <td className="px-3 py-1.5 text-[#E2E8F0] font-sans font-medium uppercase truncate max-w-[180px]" title={t.traderName}>{t.traderName}</td>
                    
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {(() => {
                        const waUrl = generateWhatsAppLink(t.contactNumber, t.traderName, t.valetaxId, t.country);
                        if (waUrl && t.contactNumber !== '-') {
                          return (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={waUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                title={`WhatsApp chat with ${t.traderName}`}
                                className="text-emerald-400 hover:text-emerald-300 transition-colors font-mono underline decoration-emerald-500/40 hover:decoration-emerald-400 flex items-center gap-1 group/wa"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-400 shrink-0 group-hover/wa:scale-110 transition-transform" />
                                <span>{t.contactNumber}</span>
                              </a>
                              <button
                                onClick={(e) => handleCopy(t.contactNumber, `phone-${t.id}`, e)}
                                className="opacity-0 group-hover:opacity-100 text-[#D4A017]/70 hover:text-[#D4A017] p-0.5"
                              >
                                {copiedId === `phone-${t.id}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                          );
                        }
                        return <span className="text-white/40 font-mono">-</span>;
                      })()}
                    </td>

                    <td className="px-3 py-1.5 text-white/50 lowercase truncate max-w-[160px]" title={t.registerEmail}>{t.registerEmail || '-'}</td>
                    <td className="px-3 py-1.5 text-[#F3C677] truncate max-w-[130px]" title={t.tradingViewUsername}>{t.tradingViewUsername || '-'}</td>
                    <td className="px-3 py-1.5 text-[#D4A017] font-bold">{t.valetaxId || '-'}</td>
                    <td className="px-3 py-1.5 text-white/60 whitespace-nowrap">{t.registerDateFormatted}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-emerald-400 whitespace-nowrap">{formatCurrency(t.balance, t.currency)}</td>
                    <td className="px-3 py-1.5 text-white/50 truncate max-w-[90px]">{t.accountType || '-'}</td>
                    <td className="px-3 py-1.5 text-white/40 lowercase truncate max-w-[150px]" title={t.directPartnerEmail}>{t.directPartnerEmail || '-'}</td>
                    <td className="px-3 py-1.5 text-center whitespace-nowrap">{getStatusBadge(t.status)}</td>

                    {/* Last Updated (STRICT COLUMN W) */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {isChecked ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-emerald-300 font-semibold">{t.lastUpdateFormatted}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 font-bold">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-[#050505] px-4 py-2 border-t border-[#3E2D17] flex flex-col sm:flex-row items-center justify-between text-[9px] font-mono text-[#D4A017]/60 uppercase gap-2">
        <span>
          Showing entries {safeTraders.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + ITEMS_PER_PAGE, safeTraders.length)} of {safeTraders.length} records
        </span>
        <div className="flex items-center gap-1 text-white">
          <span>Page {validCurrentPage} of {totalPages}</span>
        </div>
      </div>
    </div>
  );
};
