/* Powered by IqwanEngine */

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  Database,
  Sparkles,
  Lock,
  LogOut,
  UserCheck,
  Zap,
  Activity
} from 'lucide-react';
import { AuthUser } from '../types';

interface HeaderProps {
  latestRegistrationDate: string | null;
  lastUpdateByEngine: string;
  isSyncing: boolean;
  onRefresh: () => void;
  nextSyncSeconds: number;
  currentUser: AuthUser | null;
  onOpenAuthModal: () => void;
  onOpenAppsScriptModal: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  latestRegistrationDate,
  lastUpdateByEngine,
  isSyncing,
  onRefresh,
  nextSyncSeconds,
  currentUser,
  onOpenAuthModal,
  onOpenAppsScriptModal,
  onLogout
}) => {
  const [systemTime, setSystemTime] = useState<string>('');

  // Live real-time system clock updating every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kuala_Lumpur'
      });
      setSystemTime(`${formatted} MYT`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex flex-col border-b border-[#3E2D17] bg-[#0A0A0F] z-20 relative">
      {/* Top Banner Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between px-4 sm:px-6 py-3.5 gap-3">
        {/* Brand Name & Subtitle */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[#D4A017] text-xl sm:text-2xl font-bold tracking-[0.2em] leading-none">
              OWL ALGO DATABASE
            </h1>
            <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-[#1A1408] text-[#F3C677] border border-[#D4A017]/30 font-mono">
              v2.4
            </span>
          </div>
          <p className="text-[9px] tracking-[0.4em] text-[#E2E8F0]/50 mt-1 uppercase font-mono">
            ENGINEERED BY IQWANENGINE
          </p>
        </div>

        {/* Bento Clock & Sync Metrics */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-[10px]">
          {/* System Clock */}
          <div className="flex flex-col text-left md:text-right">
            <span className="text-[#D4A017]/60 uppercase text-[8px] tracking-wider font-semibold">
              System Timestamp
            </span>
            <span className="text-white whitespace-nowrap">
              {systemTime || '2026-08-27 17:52:00 MYT'}
            </span>
          </div>

          {/* Latest Reg Date */}
          <div className="flex flex-col text-left md:text-right md:border-l md:border-[#3E2D17] md:pl-6">
            <span className="text-[#D4A017]/60 uppercase text-[8px] tracking-wider font-semibold">
              Latest Reg (MY/ID)
            </span>
            <span className="text-white uppercase whitespace-nowrap truncate max-w-[200px]" title={latestRegistrationDate || '-'}>
              {latestRegistrationDate ? latestRegistrationDate.replace(' (MYT)', '') : 'Synchronizing...'}
            </span>
          </div>

          {/* Last Engine Sync */}
          <div className="flex flex-col text-left md:text-right md:border-l md:border-[#3E2D17] md:pl-6">
            <span className="text-[#D4A017]/60 uppercase text-[8px] tracking-wider font-semibold">
              OWL_ENGINE SYNC ({nextSyncSeconds}s)
            </span>
            <span className="text-[#D4A017] flex items-center gap-1 font-bold">
              <span className={`w-1.5 h-1.5 bg-[#D4A017] rounded-full ${isSyncing ? 'animate-ping' : 'animate-pulse'}`} />
              {isSyncing ? 'SYNCING...' : 'ONLINE'}
            </span>
          </div>

          {/* Apps Script & Refresh Actions */}
          <div className="flex items-center gap-2 md:border-l md:border-[#3E2D17] md:pl-6">
            <button
              onClick={onOpenAppsScriptModal}
              title="View or Check IqwanEngine punya coding"
              className="px-2 py-1 bg-[#1A1408] border border-[#D4A017]/40 text-[#D4A017] hover:bg-[#D4A017] hover:text-black rounded-xs text-[9px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Database className="w-3 h-3" />
              <span className="hidden sm:inline">I.E SCRIPT</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={isSyncing}
              title="Manual Force Refresh Data"
              className="p-1 bg-[#1A1408] border border-[#D4A017]/40 text-[#D4A017] hover:bg-[#D4A017] hover:text-black rounded-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* User Auth Info / Switch */}
          {currentUser?.isAuthorized ? (
            <div className="flex items-center gap-2 md:border-l md:border-[#3E2D17] md:pl-6">
              <div className="flex flex-col text-left md:text-right">
                <span className="text-[#D4A017]/60 uppercase text-[8px] tracking-wider font-semibold">
                  OWLFX USER
                </span>
                <span className="text-[#F3C677] text-[10px] font-mono truncate max-w-[130px]" title={currentUser.email}>
                  {currentUser.email}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out / Switch"
                className="p-1 rounded-sm border border-[#3E2D17] hover:border-red-400 text-[#71717A] hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="bg-[#D4A017] text-black px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase cursor-pointer hover:bg-[#F3C677] transition-colors rounded-sm"
            >
              Verify Auth
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
