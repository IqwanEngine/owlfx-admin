/* Powered by IqwanEngine */

import React from 'react';
import { ShieldX, Lock, ArrowRight, UserCheck, Mail } from 'lucide-react';

interface AccessDenied403Props {
  unauthorizedEmail: string;
  onOpenAuthModal: () => void;
  onQuickAuthorize: (email: string) => void;
}

export const AccessDenied403: React.FC<AccessDenied403Props> = ({
  unauthorizedEmail,
  onOpenAuthModal,
  onQuickAuthorize
}) => {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono">
      
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4A017]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Branding */}
      <div className="flex flex-col items-center text-center mb-6 relative z-10">
        <span className="text-sm font-bold text-white tracking-[0.2em] uppercase">
          OWL ALGO DATABASE
        </span>
        <span className="text-[10px] tracking-[0.2em] text-[#D4A017]/70 uppercase mt-0.5">
          ENGINEERED BY IQWANENGINE
        </span>
      </div>

      {/* 403 Security Terminal Bento Box */}
      <div className="bg-[#0A0A0F] w-full max-w-lg rounded-sm p-6 border border-[#3E2D17] shadow-2xl relative z-10 text-center">
        
        {/* Crest Lock Badge */}
        <div className="mx-auto w-12 h-12 rounded-sm bg-[#050505] border border-rose-500/40 flex items-center justify-center mb-4 relative">
          <ShieldX className="w-6 h-6 text-rose-400 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 flex items-center justify-center">
            <Lock className="w-2 h-2 text-white" />
          </div>
        </div>

        {/* Error Code & Title */}
        <div className="inline-block px-2.5 py-0.5 rounded-xs bg-rose-950/80 border border-rose-800/60 text-rose-400 text-[10px] font-bold uppercase tracking-widest mb-2.5">
          HTTP 403 FORBIDDEN
        </div>

        <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider mb-1.5">
          ACCESS DENIED: UNAUTHORIZED EMAIL
        </h2>

        <p className="text-xs text-[#A1A1AA] leading-relaxed mb-4">
          The email address you signed in with is not registered on the whitelist configuration (
          <code className="text-[#D4A017]">ALLOWED_EMAILS</code>).
        </p>

        {/* Attempted Email Badge */}
        <div className="p-3 bg-[#050505] border border-rose-900/40 rounded-sm mb-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-left">
            <Mail className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[8px] uppercase font-bold text-[#71717A] block">REJECTED CREDENTIAL</span>
              <span className="text-xs font-bold text-rose-300 truncate block">
                {unauthorizedEmail || 'unknown_account@domain.com'}
              </span>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded-xs bg-rose-950 text-rose-400 text-[9px] font-bold border border-rose-800/40">
            NOT WHITELISTED
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={onOpenAuthModal}
            className="w-full py-2.5 px-4 rounded-sm bg-[#D4A017] text-black text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#F3C677] transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>SWITCH TO WHITELISTED ADMIN</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Quick Demo Authorized Switches */}
          <div className="pt-2.5 border-t border-[#3E2D17]">
            <span className="text-[9px] uppercase tracking-wider text-[#D4A017]/70 font-bold block mb-1.5 text-left">
              QUICK VERIFICATION (WHITELIST PRESETS)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                onClick={() => onQuickAuthorize('hairuliqwan352@gmail.com')}
                className="p-2 bg-[#050505] border border-[#3E2D17] hover:border-[#D4A017] text-[10px] text-[#E2E8F0] hover:text-[#D4A017] transition-all text-left truncate flex items-center gap-1.5 rounded-sm cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">hairuliqwan352@gmail.com</span>
              </button>
              <button
                onClick={() => onQuickAuthorize('admin@owlfx.my')}
                className="p-2 bg-[#050505] border border-[#3E2D17] hover:border-[#D4A017] text-[10px] text-[#E2E8F0] hover:text-[#D4A017] transition-all text-left truncate flex items-center gap-1.5 rounded-sm cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">admin@owlfx.my</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-[#3E2D17] text-[8px] text-[#71717A] uppercase flex items-center justify-between">
          <span>ROUTE: /owlalgo-access-secured</span>
          <span>WHITELIST GUARD V2.4</span>
        </div>

      </div>

    </div>
  );
};
