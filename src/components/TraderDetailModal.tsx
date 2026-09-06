/* Powered by IqwanEngine */

import React, { useState } from 'react';
import { TraderRecord } from '../types';
import { 
  X, 
  Copy, 
  Check, 
  Wallet, 
  User, 
  Server,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { formatCurrency, generateWhatsAppLink } from '../utils/formatters';

interface TraderDetailModalProps {
  trader: TraderRecord | null;
  onClose: () => void;
}

export const TraderDetailModal: React.FC<TraderDetailModalProps> = ({ trader, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!trader) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-[#0A0A0F] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-sm border border-[#3E2D17] shadow-2xl relative font-mono text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="p-4 border-b border-[#3E2D17] bg-[#3E2D17]/20 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{trader.country === 'MY' ? '🇲🇾' : '🇮🇩'}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {trader.traderName}
                </h3>
                <span className="px-1.5 py-0.5 rounded-xs text-[9px] font-bold bg-[#141008] text-[#D4A017] border border-[#D4A017]/30">
                  VALETAX #{trader.valetaxId}
                </span>
              </div>
              <p className="text-[10px] text-[#71717A] uppercase mt-0.5">
                DATABASE: {trader.country === 'MY' ? 'MALAYSIA' : 'INDONESIA'} | ROW #{trader.rowIndex}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-sm border border-[#3E2D17] hover:border-[#D4A017] text-[#71717A] hover:text-[#D4A017] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Status Diagnostic Banner */}
          <div className="p-3 bg-[#050505] border border-[#3E2D17] rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-[9px] uppercase font-bold tracking-widest text-[#D4A017]/70">TRADING STATUS</div>
              <div className="text-xs font-bold text-[#F3C677] flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#D4A017] animate-pulse" />
                {trader.status}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-[9px] uppercase font-bold tracking-widest text-[#D4A017]/70">ACCOUNT BALANCE</div>
              <div className="text-base font-bold text-emerald-400">
                {formatCurrency(trader.balance, trader.currency)}
              </div>
            </div>
          </div>

          {/* Financial & Margin Diagnostics Grid */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#D4A017]/70 mb-2 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-[#D4A017]" />
              <span>FINANCIAL DIAGNOSTICS</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[9px] uppercase text-[#71717A] font-bold block">Equity</span>
                <span className="text-xs font-bold text-white">
                  {formatCurrency(trader.equity, trader.currency)}
                </span>
              </div>
              <div className="p-2.5 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[9px] uppercase text-[#71717A] font-bold block">Credit</span>
                <span className="text-xs font-bold text-white/80">
                  {formatCurrency(trader.credit, trader.currency)}
                </span>
              </div>
              <div className="p-2.5 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[9px] uppercase text-[#71717A] font-bold block">Margin</span>
                <span className="text-xs font-bold text-white/80">
                  {formatCurrency(trader.margin, trader.currency)}
                </span>
              </div>
              <div className="p-2.5 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[9px] uppercase text-[#71717A] font-bold block">Leverage</span>
                <span className="text-xs font-bold text-[#F3C677]">
                  1:{trader.leverage}
                </span>
              </div>
            </div>
          </div>

          {/* Contact & Registration Information */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#D4A017]/70 mb-2 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#D4A017]" />
              <span>REGISTRATION CREDENTIALS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              
              {/* Register Email */}
              <div className="p-2.5 bg-[#050505] border border-[#3E2D17] rounded-sm flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-[9px] uppercase text-[#71717A] font-bold block">Register Email</span>
                  <span className="text-white font-mono break-all">{trader.registerEmail || '-'}</span>
                </div>
                {trader.registerEmail && (
                  <button
                    onClick={() => handleCopy(trader.registerEmail, 'email')}
                    className="p-1 rounded border border-[#3E2D17] hover:border-[#D4A017] text-[#71717A] hover:text-[#D4A017]"
                  >
                    {copiedKey === 'email' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Contact Phone with One-Click WhatsApp */}
              <div className="p-2.5 bg-[#050505] border border-[#3E2D17] rounded-sm flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-[9px] uppercase text-[#71717A] font-bold block">Contact Number</span>
                  {(() => {
                    const waUrl = generateWhatsAppLink(trader.contactNumber, trader.traderName, trader.valetaxId, trader.country);
                    if (waUrl && trader.contactNumber !== '-') {
                      return (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open WhatsApp Chat"
                          className="text-emerald-400 hover:text-emerald-300 transition-colors font-mono underline decoration-emerald-500/40 hover:decoration-emerald-400 flex items-center gap-1.5 mt-0.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{trader.contactNumber}</span>
                        </a>
                      );
                    }
                    return <span className="text-white font-mono">{trader.contactNumber}</span>;
                  })()}
                </div>
                {trader.contactNumber !== '-' && (
                  <button
                    onClick={() => handleCopy(trader.contactNumber, 'phone')}
                    className="p-1 rounded border border-[#3E2D17] hover:border-[#D4A017] text-[#71717A] hover:text-[#D4A017]"
                    title="Copy Phone Number"
                  >
                    {copiedKey === 'phone' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* TradingView Username */}
              <div className="p-2.5 bg-[#050505] border border-[#3E2D17] rounded-sm flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-[9px] uppercase text-[#71717A] font-bold block">TradingView Username</span>
                  <span className="text-[#F3C677] font-bold">{trader.tradingViewUsername || '-'}</span>
                </div>
                {trader.tradingViewUsername && trader.tradingViewUsername !== '-' && (
                  <button
                    onClick={() => handleCopy(trader.tradingViewUsername, 'tv')}
                    className="p-1 rounded border border-[#3E2D17] hover:border-[#D4A017] text-[#71717A] hover:text-[#D4A017]"
                  >
                    {copiedKey === 'tv' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Direct Partner Email */}
              <div className="p-2.5 bg-[#050505] border border-[#3E2D17] rounded-sm flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-[9px] uppercase text-[#71717A] font-bold block">Direct Partner Email</span>
                  <span className="text-white/70 break-all">{trader.directPartnerEmail || '-'}</span>
                </div>
                {trader.directPartnerEmail && trader.directPartnerEmail !== '-' && (
                  <button
                    onClick={() => handleCopy(trader.directPartnerEmail, 'partner')}
                    className="p-1 rounded border border-[#3E2D17] hover:border-[#D4A017] text-[#71717A] hover:text-[#D4A017]"
                  >
                    {copiedKey === 'partner' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Technical Specifications & Server Info */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#D4A017]/70 mb-2 flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-[#D4A017]" />
              <span>PLATFORM SPECIFICATIONS</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-2 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[8px] uppercase text-[#71717A] font-bold block">Platform</span>
                <span className="text-white font-semibold">{trader.platform}</span>
              </div>
              <div className="p-2 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[8px] uppercase text-[#71717A] font-bold block">Server</span>
                <span className="text-white/80 truncate block">{trader.server}</span>
              </div>
              <div className="p-2 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[8px] uppercase text-[#71717A] font-bold block">Account Type</span>
                <span className="text-white/80">{trader.accountType}</span>
              </div>
              <div className="p-2 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[8px] uppercase text-[#71717A] font-bold block">Level</span>
                <span className="text-[#F3C677] font-bold">Tier {trader.level}</span>
              </div>
              <div className="p-2 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[8px] uppercase text-[#71717A] font-bold block">Register Date</span>
                <span className="text-white/80">{trader.registerDateFormatted}</span>
              </div>
              <div className="p-2 bg-[#050505] border border-[#3E2D17] rounded-sm">
                <span className="text-[8px] uppercase text-[#71717A] font-bold block">Updated TIME (Col W)</span>
                <span className="text-emerald-300 font-semibold">{trader.lastUpdateFormatted}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#3E2D17] bg-[#050505] flex items-center justify-between">
          <span className="text-[9px] text-[#71717A] uppercase">
            POWERED BY IQWANENGINE
          </span>
          <button
            onClick={onClose}
            className="bg-[#D4A017] text-black px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase cursor-pointer hover:bg-[#F3C677] transition-colors rounded-sm"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
