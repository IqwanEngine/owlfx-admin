/* Powered by IqwanEngine */

/**
 * =============================================================================
 * SECURED INSTITUTIONAL AUTHENTICATION GATEWAY
 * - Zero CPU Ambient Backdrop (pure CSS, no Matrix canvas loops)
 * - Zero Data Leaks (no hardcoded emails, keys, or whitelists in client bundle)
 * - Masked Credential Input with Toggle Visibility
 * - Seamless & Frictionless Instant Sign-In
 * - Institutional Obsidian & Gold Aesthetic
 * =============================================================================
 */

import React, { useState } from 'react';
import {
  Lock,
  X,
  Mail,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Terminal
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticate: (identity: string, passkey?: string) => Promise<boolean>;
  currentEmail?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticate
}) => {
  const [identity, setIdentity] = useState<string>('');
  const [passkey, setPasskey] = useState<string>('');
  const [showPasskey, setShowPasskey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentity = identity.trim();
    const cleanPasskey = passkey.trim();

    if (!cleanIdentity && !cleanPasskey) {
      setErrorMessage('Sila masukkan Emel Pentadbir atau Kunci Akses Keselamatan.');
      return;
    }

    setLoading(true);

    try {
      const success = await onAuthenticate(cleanIdentity, cleanPasskey);

      if (success) {
        setAuthSuccess(true);
        // Instant seamless transition into dashboard
        setTimeout(() => {
          setAuthSuccess(false);
          setIdentity('');
          setPasskey('');
          onClose();
        }, 500);
      } else {
        setErrorMessage('Pengesahan Ditolak: Kredensial tidak sah atau akaun belum diberi kuasa.');
      }
    } catch {
      setErrorMessage('Ralat sambungan gerbang keselamatan. Sila cuba sebentar lagi.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = identity.trim() !== '' || passkey.trim() !== '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none font-mono">
      {/* Zero-CPU Hardware-Accelerated Ambient Backdrop */}
      <div
        className="absolute inset-0 bg-[#05060A]/90 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Subtle Institutional Radial Gold Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(212,160,23,0.08),rgba(5,6,10,0.95))] pointer-events-none" />

      {/* Institutional Glassmorphism Bento Card */}
      <div
        className="w-full max-w-md rounded-xl border border-amber-500/25 bg-[#090C14]/95 text-xs z-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(212,160,23,0.12)] backdrop-blur-xl relative overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gold Accent Micro-Border */}
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#D4A017] to-transparent opacity-90" />

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#2A2215]/80 bg-[#0E121B]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-lg bg-[#07090E] border border-amber-500/30 flex items-center justify-center shadow-inner">
              <Lock className="w-4 h-4 text-[#D4A017]" />
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-white tracking-wider uppercase">
                  SECURED ACCESS GATEWAY
                </h3>
                <span className="text-[8px] px-1.5 py-0.5 bg-[#D4A017]/15 text-[#D4A017] border border-[#D4A017]/30 rounded font-bold tracking-widest uppercase">
                  VIP LEVEL
                </span>
              </div>
              <span className="text-[9px] text-zinc-400 tracking-wider flex items-center gap-1.5 mt-0.5 font-mono">
                <Terminal className="w-2.5 h-2.5 text-emerald-400" />
                OWL ALGO DATABASE // SECURED V2.4
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="p-3 bg-[#06080E] border border-[#2A2215]/80 rounded-lg text-[10px] text-zinc-400 leading-relaxed">
            <p>
              Masukkan e-mel pentadbir yang sah atau kunci keselamatan untuk membuka pangkalan data berprestasi tinggi.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Administrator Identity Input */}
            <div>
              <label className="block text-[9px] uppercase font-bold tracking-wider text-[#D4A017]/90 mb-1.5">
                ADMINISTRATOR IDENTITY / EMAIL
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#D4A017] transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  type="email"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="operator@owlfx.my"
                  autoComplete="username"
                  spellCheck="false"
                  disabled={loading || authSuccess}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#05070D] border border-zinc-800 focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017]/30 text-xs text-white placeholder-zinc-600 outline-none rounded-lg transition-all shadow-inner disabled:opacity-50"
                />
              </div>
            </div>

            {/* Passkey / Secret Key Input (Masked) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[9px] uppercase font-bold tracking-wider text-[#D4A017]/90 flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3 text-[#D4A017]" />
                  SECURITY PASSKEY / ACCESS KEY
                </label>
                <span className="text-[8px] text-zinc-500 font-mono">
                  ENCRYPTED
                </span>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-[#D4A017] transition-colors">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  type={showPasskey ? 'text' : 'password'}
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  placeholder="••••••••••••••••"
                  autoComplete="current-password"
                  spellCheck="false"
                  disabled={loading || authSuccess}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#05070D] border border-zinc-800 focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017]/30 text-xs text-white placeholder-zinc-600 outline-none rounded-lg transition-all shadow-inner disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey(!showPasskey)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
                  title={showPasskey ? 'Hide passkey' : 'Show passkey'}
                >
                  {showPasskey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-[10px] flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Notification */}
            {authSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px] flex items-center gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Pengesahan Berjaya! Mengalihkan ke papan pemuka...</span>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading || authSuccess || !isFormValid}
              className="w-full py-3 mt-1 rounded-lg bg-gradient-to-r from-[#D4A017] via-[#F3C677] to-[#D4A017] text-black text-[10.5px] font-black tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(212,160,23,0.25)]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>AUTHENTICATING SECURED SESSION...</span>
                </div>
              ) : authSuccess ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>SESSION AUTHORIZED</span>
                </div>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>AUTHENTICATE & UNLOCK</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#06080E] border-t border-[#2A2215]/80 flex items-center justify-between text-[8px] text-zinc-500 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Lock className="w-2.5 h-2.5 text-[#D4A017]" />
            SECURED OPERATOR PROTOCOL
          </span>
          <span className="font-semibold text-zinc-400">POWERED BY IQWANENGINE</span>
        </div>
      </div>
    </div>
  );
};
