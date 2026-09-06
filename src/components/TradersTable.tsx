/* Powered by IqwanEngine */

import React, { useState, useEffect } from 'react';
import { TraderRecord, MultiColumnFilterState } from '../types';
import { 
  ShieldAlert, 
  Copy, 
  Check, 
  X, 
  Trash2, 
  CheckCircle2, 
  Loader2,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { formatCurrency, generateWhatsAppLink } from '../utils/formatters';
import { TableFilterControl } from './TableFilterControl';

interface TradersTableProps {
  title: string;
  countryCode: 'MY' | 'ID';
  traders: TraderRecord[];
  onSelectTrader: (trader: TraderRecord) => void;
  onVerifyTrader: (trader: TraderRecord) => void;
  onPromptDeleteTrader: (trader: TraderRecord) => void;
  verifyingId?: string | null;
  searchTerm?: string;
  isInitialLoading?: boolean;
  // Multi-column filter props
  filterState: MultiColumnFilterState;
  onFilterChange: (newState: MultiColumnFilterState) => void;
  onResetFilters: () => void;
  availableAccountTypes: string[];
  availablePartnerEmails: string[];
  totalUnfilteredCount: number;
}

const ITEMS_PER_PAGE = 40;

export const TradersTable: React.FC<TradersTableProps> = ({
  title,
  countryCode,
  traders,
  onSelectTrader,
  onVerifyTrader,
  onPromptDeleteTrader,
  verifyingId = null,
  searchTerm = '',
  isInitialLoading = false,
  filterState,
  onFilterChange,
  onResetFilters,
  availableAccountTypes,
  availablePartnerEmails,
  totalUnfilteredCount
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-reset to page 1 whenever filters change or search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterState, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(traders.length / ITEMS_PER_PAGE));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (validCurrentPage - 1) * ITEMS_PER_PAGE;
  const currentTraders = traders.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleCopy = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handleExportCSV = () => {
    if (traders.length === 0) return;
    const headers = [
      'Row Index',
      'Country',
      'Trader Name',
      'Contact Number',
      'Register Email',
      'TradingView Username',
      'Valetax ID',
      'Register Date',
      'Balance (USD)',
      'Account Type',
      'Direct Partner Email',
      'Status',
      'Last Updated (Col W)'
    ];

    const rows = traders.map(t => [
      t.rowIndex,
      t.country,
      `"${t.traderName.replace(/"/g, '""')}"`,
      `"${t.contactNumber.replace(/"/g, '""')}"`,
      `"${t.registerEmail.replace(/"/g, '""')}"`,
      `"${t.tradingViewUsername.replace(/"/g, '""')}"`,
      `"${t.valetaxId.replace(/"/g, '""')}"`,
      `"${t.registerDateFormatted}"`,
      t.balance,
      `"${t.accountType.replace(/"/g, '""')}"`,
      `"${t.directPartnerEmail.replace(/"/g, '""')}"`,
      `"${t.status.replace(/"/g, '""')}"`,
      `"${t.lastUpdateFormatted}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OwlAlgo_${countryCode}_Database_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bento Status Badge
  const getStatusBadge = (status: string) => {
    const s = (status || '').trim().toUpperCase();

    if (s === 'VALID VIP' || s.includes('VALID VIP') && !s.includes('INDICATOR')) {
      return (
        <span className="bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-semibold">
          Valid VIP
        </span>
      );
    }

    if (s === 'VALID VIP INDICATOR' || s.includes('INDICATOR')) {
      return (
        <span className="bg-[#D4A017]/10 text-[#F3C677] border border-[#D4A017]/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-bold">
          VIP Indicator
        </span>
      );
    }

    if (s === 'ACTIVE' || s === 'VALID') {
      return (
        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-semibold">
          Active
        </span>
      );
    }

    if (s.includes('LOW')) {
      return (
        <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-semibold">
          Low Balance
        </span>
      );
    }

    if (s.includes('MC') || s.includes('MARGIN CALL')) {
      return (
        <span className="bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-semibold">
          Margin Call
        </span>
      );
    }

    if (s.includes('NOT') || s.includes('INVALID')) {
      return (
        <span className="bg-slate-500/10 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-semibold">
          Not Valid
        </span>
      );
    }

    return (
      <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full text-[8px] uppercase">
        {status || 'Unknown'}
      </span>
    );
  };

  const regionHeading = countryCode === 'MY' 
    ? 'Region: Malaysia (Kuala Lumpur)' 
    : 'Region: Indonesia (Jakarta)';

  return (
    <div className="bg-[#0A0A0F] border border-[#3E2D17] rounded-sm flex flex-col mb-4 overflow-hidden shadow-lg font-mono">
      
      {/* Bento Header Bar */}
      <div className="bg-[#3E2D17]/20 px-4 py-2 border-b border-[#3E2D17] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{countryCode === 'MY' ? '🇲🇾' : '🇮🇩'}</span>
          <h3 className="text-[10px] font-bold tracking-[0.2em] text-[#D4A017] uppercase">
            {regionHeading}
          </h3>
          <span className="text-[9px] text-[#E2E8F0]/40 font-mono">
            ({traders.length.toLocaleString()} records)
          </span>
        </div>

        {/* Top Controls & Navigation */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <button
            onClick={handleExportCSV}
            disabled={traders.length === 0}
            className="px-2 py-0.5 border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017] hover:text-black cursor-pointer uppercase transition-colors rounded-xs disabled:opacity-40"
            title="Download CSV"
          >
            Export CSV
          </button>
          
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={handlePrevPage}
              disabled={validCurrentPage <= 1}
              className="px-2 py-0.5 border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017] hover:text-black cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-colors rounded-xs uppercase"
            >
              &larr; PREV
            </button>
            <span className="text-white/70 font-mono">
              PAGE {String(validCurrentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            </span>
            <button
              onClick={handleNextPage}
              disabled={validCurrentPage >= totalPages}
              className="px-2 py-0.5 border border-[#D4A017]/30 text-[#D4A017] hover:bg-[#D4A017] hover:text-black cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-colors rounded-xs uppercase"
            >
              NEXT &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Multi-Column Filter Bar */}
      <TableFilterControl
        countryCode={countryCode}
        filterState={filterState}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
        availableAccountTypes={availableAccountTypes}
        availablePartnerEmails={availablePartnerEmails}
        totalFilteredCount={traders.length}
        totalUnfilteredCount={totalUnfilteredCount}
      />

      {/* Table Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[580px]">
        <table className="w-full text-[10px] text-left border-collapse">
          {/* Table Header */}
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

          {/* Table Body */}
          <tbody className="font-mono divide-y divide-[#3E2D17]/30">
            {isInitialLoading ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-[#A1A1AA]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 rounded-full border-2 border-[#D4A017] border-t-transparent animate-spin" />
                    <span className="text-[10px] text-[#F3C677] uppercase tracking-wider">
                      Fetching {countryCode === 'MY' ? 'Malaysia' : 'Indonesia'} Database...
                    </span>
                  </div>
                </td>
              </tr>
            ) : currentTraders.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-10 text-center text-[#71717A]">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <ShieldAlert className="w-5 h-5 text-[#71717A]" />
                    <p className="text-[11px] font-semibold text-[#A1A1AA]">No matching records found in this region</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentTraders.map((t) => {
                const isVerifyingThis = verifyingId === t.id;
                const isChecked = t.lastUpdateFormatted !== '-';

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTrader(t)}
                    className="border-b border-[#3E2D17]/40 hover:bg-[#D4A017]/5 transition-colors cursor-pointer group"
                  >
                    {/* [ Action ] DUAL BUTTONS: [ ✓ ] and [ ✕ ] */}
                    <td className="px-2 py-1.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        
                        {/* Button A: [ ✓ ] (Verify / Mark as Checked / Tick) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onVerifyTrader(t);
                          }}
                          disabled={isVerifyingThis}
                          title={isChecked ? `Reviewed: ${t.lastUpdateFormatted}. Click to re-verify.` : 'Mark as Checked / Update Review Time in Col W'}
                          className={`w-6 h-6 rounded-xs flex items-center justify-center transition-all cursor-pointer border ${
                            isChecked
                              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-400 hover:bg-emerald-800/80 hover:text-white'
                              : 'bg-[#0F0E0A] border-[#D4A017]/40 text-[#D4A017] hover:bg-[#D4A017] hover:text-black'
                          } disabled:opacity-50`}
                        >
                          {isVerifyingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          )}
                        </button>

                        {/* Button B: [ ✕ ] (Delete Record) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPromptDeleteTrader(t);
                          }}
                          title={`Delete Trader Record (Row #${t.rowIndex})`}
                          className="w-6 h-6 rounded-xs flex items-center justify-center bg-[#0F0E0A] border border-rose-600/40 text-rose-400 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3 stroke-[2.5]" />
                        </button>

                      </div>
                    </td>

                    {/* Trader Name */}
                    <td className="px-3 py-1.5 text-[#E2E8F0] font-sans font-medium uppercase truncate max-w-[180px]" title={t.traderName}>
                      {t.traderName}
                    </td>

                    {/* Contact Number with One-Click WhatsApp Action */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {(() => {
                        const waUrl = generateWhatsAppLink(t.contactNumber, t.traderName, t.valetaxId, t.country);
                        if (waUrl && t.contactNumber !== '-') {
                          return (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`WhatsApp chat with ${t.traderName}`}
                                className="text-emerald-400 hover:text-emerald-300 transition-colors font-mono underline decoration-emerald-500/40 hover:decoration-emerald-400 flex items-center gap-1 group/wa"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-400 shrink-0 group-hover/wa:scale-110 transition-transform" />
                                <span>{t.contactNumber}</span>
                              </a>
                              <button
                                onClick={(e) => handleCopy(t.contactNumber, `phone-${t.id}`, e)}
                                title="Copy Phone Number"
                                className="opacity-0 group-hover:opacity-100 text-[#D4A017]/70 hover:text-[#D4A017] p-0.5 rounded-xs"
                              >
                                {copiedId === `phone-${t.id}` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          );
                        }
                        return <span className="text-white/40 font-mono">-</span>;
                      })()}
                    </td>

                    {/* Register Email */}
                    <td className="px-3 py-1.5 text-white/50 lowercase truncate max-w-[160px]" title={t.registerEmail}>
                      {t.registerEmail || '-'}
                    </td>

                    {/* TradingView Username */}
                    <td className="px-3 py-1.5 text-[#F3C677] truncate max-w-[130px]" title={t.tradingViewUsername}>
                      {t.tradingViewUsername || '-'}
                    </td>

                    {/* Valetax ID */}
                    <td className="px-3 py-1.5 text-[#D4A017] font-bold">
                      {t.valetaxId || '-'}
                    </td>

                    {/* Register Date */}
                    <td className="px-3 py-1.5 text-white/60 whitespace-nowrap">
                      {t.registerDateFormatted}
                    </td>

                    {/* Balance */}
                    <td className="px-3 py-1.5 text-right font-bold text-emerald-400 whitespace-nowrap">
                      {formatCurrency(t.balance, t.currency)}
                    </td>

                    {/* Account Type */}
                    <td className="px-3 py-1.5 text-white/50 truncate max-w-[90px]">
                      {t.accountType || '-'}
                    </td>

                    {/* Partner Email */}
                    <td className="px-3 py-1.5 text-white/40 lowercase truncate max-w-[150px]" title={t.directPartnerEmail}>
                      {t.directPartnerEmail || '-'}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                      {getStatusBadge(t.status)}
                    </td>

                    {/* Last Updated (Column W / Column 23) */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {t.lastUpdateFormatted === '-' ? (
                        <span className="text-zinc-600 font-bold">-</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-emerald-300 font-semibold">{t.lastUpdateFormatted}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bento Bottom Summary Bar */}
      <div className="bg-[#050505] px-4 py-2 border-t border-[#3E2D17] flex flex-col sm:flex-row items-center justify-between text-[9px] font-mono text-[#D4A017]/60 uppercase gap-2">
        <span>
          Showing entries {currentTraders.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + ITEMS_PER_PAGE, traders.length)} of {traders.length} records (40 per page)
        </span>
        <div className="flex items-center gap-1 text-white">
          <span>Page {validCurrentPage} of {totalPages}</span>
        </div>
      </div>

    </div>
  );
};

