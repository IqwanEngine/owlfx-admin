/* Powered by IqwanEngine */

import React, { useState } from 'react';
import { X, Copy, Check, Code2, Database } from 'lucide-react';

interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const scriptCode = `/* Powered by IqwanEngine */
/**
 * OWL ALGO DATABASE - Google Apps Script VIP Data Handler
 * Supports 23 Columns (Col A to Col W) including Col W (Updated TIME).
 * Handles verify (updateReviewTime) and delete (deleteVIPRecord) actions.
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'fetch';
  
  if (action === 'fetch') {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: getVIPData()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'updateReviewTime' || action === 'verify') {
    var rowIndex = parseInt(e.parameter.rowIndex || e.parameter.row_index, 10);
    var timestamp = e.parameter.timestamp || Utilities.formatDate(new Date(), 'GMT+8', 'yyyy-MM-dd HH:mm:ss');
    var result = updateReviewTime(rowIndex, timestamp);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'deleteVIPRecord' || action === 'delete') {
    var delRowIndex = parseInt(e.parameter.rowIndex || e.parameter.row_index, 10);
    var delResult = deleteVIPRecord(delRowIndex);
    return ContentService.createTextOutput(JSON.stringify(delResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: 'Unknown action: ' + action
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (err) {
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }
    
    var action = postData.action || 'verify';
    
    if (action === 'updateReviewTime' || action === 'verify') {
      var rowIndex = parseInt(postData.rowIndex || postData.row_index, 10);
      var timestamp = postData.timestamp || Utilities.formatDate(new Date(), 'GMT+8', 'yyyy-MM-dd HH:mm:ss');
      var result = updateReviewTime(rowIndex, timestamp);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'deleteVIPRecord' || action === 'delete') {
      var delRowIndex = parseInt(postData.rowIndex || postData.row_index, 10);
      var delResult = deleteVIPRecord(delRowIndex);
      return ContentService.createTextOutput(JSON.stringify(delResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'add') {
      var addResult = addVIPRecord(postData);
      return ContentService.createTextOutput(JSON.stringify(addResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown POST action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Reads 23 columns (Col A to W) including Column W (Updated TIME).
 */
function getVIPData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  // Read 23 columns (Columns A through W)
  var range = sheet.getRange(2, 1, lastRow - 1, 23);
  var values = range.getValues();
  var results = [];
  
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var actualRowIndex = i + 2;
    
    // Column W is index 22 in zero-based array
    var updatedTimeVal = row[22] !== undefined && row[22] !== null && String(row[22]).trim() !== ''
      ? (row[22] instanceof Date ? Utilities.formatDate(row[22], 'GMT+8', 'yyyy-MM-dd HH:mm:ss') : String(row[22]).trim())
      : '-';

    var rawPhone = row[1] || '-';
    var cleanPhone = sanitizePhone_(rawPhone);

    results.push({
      row_index: actualRowIndex,
      trader_name: row[0] || 'UNKNOWN TRADER',
      contact_number: cleanPhone,
      register_email: row[2] || '-',
      trading_view_username: row[3] || '-',
      valetax_id: row[4] || '-',
      register_date: row[5] ? (row[5] instanceof Date ? row[5].toISOString() : String(row[5])) : '',
      service_days: row[6] || '-',
      updated_by: row[7] || 'System Form',
      level: row[8] || 1,
      direct_partner_email: row[9] || '-',
      balance: sanitizeBalance(row[10]),
      equity: sanitizeBalance(row[11]),
      credit: sanitizeBalance(row[12]),
      margin: sanitizeBalance(row[13]),
      leverage: parseFloat(String(row[14] || 100).replace(/[^0-9.]/g, '')) || 100,
      account_name: row[15] || '-',
      account_type: row[16] || '-',
      server: row[17] || '-',
      platform: row[18] || 'meta4',
      date_of_creation: row[19] ? (row[19] instanceof Date ? row[19].toISOString() : String(row[19])) : '-',
      currency: row[20] || 'USD',
      status: row[21] || 'Active',
      updated_time: updatedTimeVal, // Column W (Column 23)
      last_update: updatedTimeVal
    });
  }
  
  return results;
}

/**
 * Numerical sanitization for monetary and account balance values.
 * Removes thousand-separator commas and non-numeric characters.
 */
function sanitizeBalance(raw, accountType, currency) {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  var str = String(raw).trim();
  if (str === '' || str === '-' || /n\\/?a/i.test(str)) return 0;
  
  // Remove thousand commas and non-numeric chars except minus and decimal point
  var cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  var num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return num;
}

/**
 * Smart regional phone sanitization supporting Malaysian (+60) and Indonesian (+62) numbers.
 */
function sanitizePhone_(rawPhone, region) {
  if (!rawPhone || String(rawPhone).trim() === '' || String(rawPhone).trim() === '-') {
    return '-';
  }
  var reg = region || 'MY';

  // 1.1 Character Stripping: Remove all non-digit characters except the leading plus sign
  var cleaned = String(rawPhone).trim();
  var hasLeadingPlus = cleaned.indexOf('+') === 0;
  cleaned = cleaned.replace(/[^\\d+]/g, '');
  
  if (cleaned.indexOf('+') === 0) {
    cleaned = '+' + cleaned.substring(1).replace(/\\+/g, '');
  } else if (hasLeadingPlus) {
    cleaned = '+' + cleaned.replace(/\\+/g, '');
  }

  if (!cleaned || cleaned === '+') {
    return '-';
  }

  // 1.2 Explicit International Formats
  if (cleaned.indexOf('+60') === 0 || cleaned.indexOf('+62') === 0) {
    return cleaned;
  }
  if (cleaned.indexOf('60') === 0 && cleaned.length >= 9) {
    return '+' + cleaned;
  }
  if (cleaned.indexOf('62') === 0 && cleaned.length >= 9) {
    return '+' + cleaned;
  }

  // 1.3 Local Zero Prefix Smart Routing
  if (cleaned.indexOf('08') === 0) {
    return '+62' + cleaned.substring(1);
  }
  if (cleaned.indexOf('01') === 0) {
    return '+60' + cleaned.substring(1);
  }
  if (cleaned.indexOf('0') === 0) {
    var prefix = reg === 'ID' ? '+62' : '+60';
    return prefix + cleaned.substring(1);
  }

  var defaultPrefix = reg === 'ID' ? '+62' : '+60';
  return defaultPrefix + cleaned;
}

/**
 * Updates Column W (Column 23 - Updated TIME) with GMT+8 Timestamp
 */
function updateReviewTime(rowIndex, timestamp) {
  if (!rowIndex || isNaN(rowIndex) || rowIndex < 2) {
    return { success: false, error: 'Invalid rowIndex' };
  }
  
  var ts = timestamp || Utilities.formatDate(new Date(), 'GMT+8', 'yyyy-MM-dd HH:mm:ss');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Set Column W (Column 23)
  sheet.getRange(rowIndex, 23).setValue(ts);
  
  return {
    success: true,
    rowIndex: rowIndex,
    updatedTime: ts,
    message: 'Row ' + rowIndex + ' Column W updated successfully'
  };
}

/**
 * Deletes or clears a VIP trader row from the spreadsheet
 */
function deleteVIPRecord(rowIndex) {
  if (!rowIndex || isNaN(rowIndex) || rowIndex < 2) {
    return { success: false, error: 'Invalid rowIndex' };
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.deleteRow(rowIndex);
  
  return {
    success: true,
    rowIndex: rowIndex,
    message: 'Row ' + rowIndex + ' deleted successfully'
  };
}

/**
 * Adds new trader record, setting Column 23 (Col W) default to '-'
 */
function addVIPRecord(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var newRow = [
    data.trader_name || '',
    sanitizePhone_(data.contact_number, data.region || 'MY'),
    data.register_email || '',
    data.trading_view_username || '',
    data.valetax_id || '',
    data.register_date || Utilities.formatDate(new Date(), 'GMT+8', 'yyyy-MM-dd HH:mm:ss'),
    data.service_days || '-',
    data.updated_by || 'System Form',
    data.level || 1,
    data.direct_partner_email || '',
    data.balance || 0,
    data.equity || 0,
    data.credit || 0,
    data.margin || 0,
    data.leverage || 100,
    data.account_name || '',
    data.account_type || '',
    data.server || '',
    data.platform || 'meta4',
    data.date_of_creation || '-',
    data.currency || 'USD',
    data.status || 'Active',
    '-' // Column W (Column 23) initial unreviewed state
  ];
  sheet.appendRow(newRow);
  return { success: true, rowIndex: sheet.getLastRow() };
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
      <div 
        className="bg-[#0A0A0F] border border-[#3E2D17] w-full max-w-3xl rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#3E2D17]/30 px-4 py-3 border-b border-[#3E2D17] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-[#D4A017]/20 border border-[#D4A017]/40 flex items-center justify-center">
              <Code2 className="w-3.5 h-3.5 text-[#D4A017]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#D4A017] uppercase tracking-wider">
                GOOGLE APPS SCRIPT BACKEND SYNC CODE (MY & ID)
              </h3>
              <span className="text-[9px] text-[#A1A1AA] uppercase">
                23-Column Integration (Col W Review Time) & Endpoints
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-white transition-colors cursor-pointer p-1 rounded-sm hover:bg-[#3E2D17]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-[#050505] px-4 py-2.5 border-b border-[#3E2D17] text-[10px] text-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Database className="w-3.5 h-3.5 text-[#D4A017]" />
            <span>Deploy in both Malaysia & Indonesia Apps Script projects as a Web App (Access: Anyone).</span>
          </div>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 bg-[#D4A017] text-black font-bold text-[9px] uppercase rounded-xs hover:bg-[#F3C677] cursor-pointer flex items-center gap-1 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-950" />
                <span>Copied Code!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Script</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content Area */}
        <div className="p-4 overflow-y-auto flex-1 bg-[#050505] font-mono text-[11px] text-[#A1A1AA] leading-relaxed select-all">
          <pre className="whitespace-pre overflow-x-auto text-zinc-300">
            <code>{scriptCode}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="bg-[#0A0A0F] px-4 py-2.5 border-t border-[#3E2D17] flex justify-between items-center text-[9px] text-[#71717A]">
          <span>Signature: /* Powered by IqwanEngine */</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#050505] border border-[#3E2D17] text-white hover:border-[#D4A017] rounded-xs cursor-pointer uppercase transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
