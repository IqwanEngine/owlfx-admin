/* Powered by IqwanEngine */

import React from 'react';
import { TraderRecord } from '../types';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface DeleteConfirmModalProps {
  trader: TraderRecord | null;
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  trader,
  isOpen,
  isDeleting,
  onClose,
  onConfirmDelete
}) => {
  if (!isOpen || !trader) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
      <div 
        className="bg-[#0A0A0F] border border-rose-600/50 w-full max-w-md rounded-sm shadow-[0_0_50px_rgba(225,29,72,0.2)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-rose-950/40 px-4 py-3 border-b border-rose-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-rose-950 border border-rose-500/50 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-rose-300 uppercase tracking-widest">
                CONFIRM DELETION
              </h3>
              <span className="text-[9px] text-[#A1A1AA] uppercase">
                DATABASE ENTRY DELETION PROTOCOL
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-[#71717A] hover:text-white transition-colors cursor-pointer p-1 rounded-sm hover:bg-rose-900/20 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 space-y-3">
          
          <div className="p-3 bg-[#050505] border border-rose-900/30 rounded-sm">
            <p className="text-xs text-[#E2E8F0] leading-relaxed">
              Are you sure you want to delete this trader record from the{' '}
              <span className="text-[#D4A017] font-bold">
                {trader.country === 'MY' ? 'Malaysia' : 'Indonesia'}
              </span>{' '}
              database?
            </p>
          </div>

          {/* Trader Record Summary Bento Box */}
          <div className="bg-[#050505] border border-[#3E2D17] rounded-sm p-3 space-y-1.5 text-[10px]">
            <div className="flex justify-between border-b border-[#3E2D17]/40 pb-1">
              <span className="text-[#71717A] uppercase">Trader Name:</span>
              <span className="text-white font-bold uppercase truncate max-w-[200px]" title={trader.traderName}>
                {trader.traderName}
              </span>
            </div>

            <div className="flex justify-between border-b border-[#3E2D17]/40 pb-1">
              <span className="text-[#71717A] uppercase">Valetax ID:</span>
              <span className="text-[#D4A017] font-bold">{trader.valetaxId}</span>
            </div>

            <div className="flex justify-between border-b border-[#3E2D17]/40 pb-1">
              <span className="text-[#71717A] uppercase">Google Sheet Row:</span>
              <span className="text-white">Row #{trader.rowIndex}</span>
            </div>

            <div className="flex justify-between border-b border-[#3E2D17]/40 pb-1">
              <span className="text-[#71717A] uppercase">Current Balance:</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(trader.balance, trader.currency)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-[#71717A] uppercase">Registered Email:</span>
              <span className="text-white/60 lowercase truncate max-w-[200px]">{trader.registerEmail || '-'}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-sm bg-rose-950/20 border border-rose-900/40 text-[9px] text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>
              This will execute a deletion request on Google Apps Script and remove this row from the active table view immediately.
            </span>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="bg-[#050505] px-4 py-3 border-t border-[#3E2D17] flex items-center justify-end gap-2 text-[10px]">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-3 py-1.5 bg-[#0A0A0F] border border-[#3E2D17] text-[#A1A1AA] hover:text-white hover:border-[#D4A017]/50 rounded-sm cursor-pointer transition-colors uppercase disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmDelete}
            disabled={isDeleting}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-sm flex items-center gap-1.5 cursor-pointer transition-colors uppercase shadow-lg disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
