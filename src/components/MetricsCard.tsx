/* Powered by IqwanEngine */

import React from 'react';
import { CountryMetrics } from '../types';
import { formatCurrency } from '../utils/formatters';

interface MetricsCardProps {
  malaysiaMetrics: CountryMetrics | null;
  indonesiaMetrics: CountryMetrics | null;
  activeStatusFilter: string | null;
  activeCountryFilter: 'MY' | 'ID' | null;
  onFilterStatus: (status: string | null, country: 'MY' | 'ID' | null) => void;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  malaysiaMetrics,
  indonesiaMetrics,
  activeStatusFilter,
  activeCountryFilter,
  onFilterStatus
}) => {
  const renderBentoCard = (metrics: CountryMetrics | null, countryCode: 'MY' | 'ID') => {
    const isMY = countryCode === 'MY';
    const countryTitle = isMY ? 'Database Malaysia' : 'Database Indonesia';
    const totalTraders = metrics?.totalTraders || 0;
    const totalBalance = metrics?.totalBalanceUSD || 0;
    const b = metrics?.statusBreakdown || {
      active: 0,
      lowBal: 0,
      mc: 0,
      notValid: 0,
      validVip: 0,
      validVipIndicator: 0,
      other: 0,
      total: 0
    };

    const isThisCountryActive = activeCountryFilter === countryCode;

    return (
      <div
        className={`bg-[#0A0A0F]/90 border ${
          isThisCountryActive ? 'border-[#D4A017] ring-1 ring-[#D4A017]' : 'border-[#D4A017]/20 hover:border-[#D4A017]/40'
        } rounded-md p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center backdrop-blur-md relative overflow-hidden group shadow-lg transition-all gap-3`}
      >
        {/* Large Bento Country Watermark */}
        <div className="absolute -right-3 -bottom-3 sm:-right-4 sm:-bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none select-none">
          <span className="text-8xl sm:text-9xl font-black italic text-[#D4A017] tracking-tighter">
            {countryCode}
          </span>
        </div>

        {/* Left Side: Title, Big Number & Total Assets */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-bold text-[#D4A017] tracking-widest uppercase">
              {countryTitle}
            </p>
            {isThisCountryActive && (
              <button
                onClick={() => onFilterStatus(null, null)}
                className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-[#2D1F10] border border-[#D4A017]/50 text-[#F3C677] hover:bg-[#3E2D17] transition-all font-mono"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div
            onClick={() => onFilterStatus(null, countryCode)}
            className="cursor-pointer group/traders inline-block"
            title="Filter by this region"
          >
            <p className="text-3xl sm:text-4xl font-mono font-bold text-white tracking-tight flex items-baseline gap-1.5">
              <span>{totalTraders.toLocaleString()}</span>
              <span className="text-xs text-[#E2E8F0]/40 font-sans tracking-normal font-normal group-hover/traders:text-[#D4A017] transition-colors">
                Traders
              </span>
            </p>
          </div>

          <p className="text-[10px] font-mono text-emerald-400 font-semibold mt-0.5">
            Total: {formatCurrency(totalBalance)} USD
          </p>
        </div>

        {/* Right Side: 3-Column Micro Status Grid */}
        <div className="grid grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-1.5 text-[9px] uppercase font-semibold text-right relative z-10 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#241B10]">

          {/* Active */}
          <button
            onClick={() => onFilterStatus('ACTIVE', countryCode)}
            className={`flex flex-col text-right hover:opacity-80 transition-opacity p-1 rounded-sm ${
              activeStatusFilter === 'ACTIVE' && isThisCountryActive ? 'bg-green-500/10 ring-1 ring-green-500/40' : ''
            }`}
          >
            <span className="text-green-500">Active</span>
            <span className="font-mono text-white text-xs font-bold">{b.active.toLocaleString()}</span>
          </button>

          {/* Low Bal */}
          <button
            onClick={() => onFilterStatus('LOW BAL', countryCode)}
            className={`flex flex-col text-right hover:opacity-80 transition-opacity p-1 rounded-sm ${
              activeStatusFilter === 'LOW BAL' && isThisCountryActive ? 'bg-yellow-500/10 ring-1 ring-yellow-500/40' : ''
            }`}
          >
            <span className="text-yellow-500">Low Bal</span>
            <span className="font-mono text-white text-xs font-bold">{b.lowBal.toLocaleString()}</span>
          </button>

          {/* MC */}
          <button
            onClick={() => onFilterStatus('MC', countryCode)}
            className={`flex flex-col text-right hover:opacity-80 transition-opacity p-1 rounded-sm ${
              activeStatusFilter === 'MC' && isThisCountryActive ? 'bg-red-500/10 ring-1 ring-red-500/40' : ''
            }`}
          >
            <span className="text-red-500">MC</span>
            <span className="font-mono text-white text-xs font-bold">{b.mc.toLocaleString()}</span>
          </button>

          {/* Valid VIP */}
          <button
            onClick={() => onFilterStatus('VALID VIP', countryCode)}
            className={`flex flex-col text-right hover:opacity-80 transition-opacity p-1 rounded-sm ${
              activeStatusFilter === 'VALID VIP' && isThisCountryActive ? 'bg-blue-500/10 ring-1 ring-blue-500/40' : ''
            }`}
          >
            <span className="text-blue-400">Valid VIP</span>
            <span className="font-mono text-white text-xs font-bold">{b.validVip.toLocaleString()}</span>
          </button>

          {/* Not Valid */}
          <button
            onClick={() => onFilterStatus('NOT VALID', countryCode)}
            className={`flex flex-col text-right hover:opacity-80 transition-opacity p-1 rounded-sm ${
              activeStatusFilter === 'NOT VALID' && isThisCountryActive ? 'bg-red-500 ring-1 ring-red-500/40' : ''
            }`}
          >
            <span className="text-red-500">Not Valid</span>
            <span className="font-mono text-white text-xs font-bold">{b.notValid.toLocaleString()}</span>
          </button>

          {/* Indicate */}
          <button
            onClick={() => onFilterStatus('VALID VIP INDICATOR', countryCode)}
            className={`flex flex-col text-right hover:opacity-80 transition-opacity p-1 rounded-sm ${
              activeStatusFilter === 'VALID VIP INDICATOR' && isThisCountryActive ? 'bg-[#D4A017]/10 ring-1 ring-[#D4A017]/40' : ''
            }`}
          >
            <span className="text-[#D4A017]">VVIP</span>
            <span className="font-mono text-white text-xs font-bold">{b.validVipIndicator.toLocaleString()}</span>
          </button>

        </div>
      </div>
    );
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      {renderBentoCard(malaysiaMetrics, 'MY')}
      {renderBentoCard(indonesiaMetrics, 'ID')}
    </section>
  );
};
