/* =============================================================================
 * IqwanEngine v4.2 — Live Valetax Manual Check & On-Demand Sync API
 * Architecture : Direct Broker API Polling (Bypass Supabase Cache)
 * Safety       : Zero False Kicks, Zero Cent/IDR Corruption, On-Demand DB Persistence
 * =============================================================================
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const RAW_VALETAX_TOKEN =
  process.env.VALETAX_STATIC_TOKEN ||
  process.env.VALETAX_API_TOKEN ||
  "eyJpZCI6OTg0NjI5LCJ1c2VySWQiOjQ4NjA2LCJ0eXBlIjoic3RhdGljIiwibWZhVmVyaWZpZWQiOmZhbHNlLCJwYXNzd29yZFZlcmlmaWVkIjpmYWxzZX0o0NREtbnwV%2FjRfVaw2bqwAo3vjRqT%2BUuVvpXjq6DCrg%3D%3D";

// Prevent double URL encoding if the token already contains escaped entities (%2F, %2B, %3D)
function getNormalizedToken(token: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(token));
  } catch {
    return encodeURIComponent(token);
  }
}

const VALETAX_TOKEN_NORMALIZED = getNormalizedToken(RAW_VALETAX_TOKEN);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Standardize balance and equity to USD.
 * Converts Cent/USC (/100) and IDR (/15500).
 */
export function standardizeBalance(
  rawVal: any,
  accountType: string,
  currency: string
): number {
  if (rawVal === "-" || rawVal === null || rawVal === undefined) {
    return 0;
  }
  let num: number;
  if (typeof rawVal === "number") {
    num = isNaN(rawVal) ? 0 : rawVal;
  } else {
    const cleaned = String(rawVal).trim().replace(/[^0-9.-]/g, "");
    num = parseFloat(cleaned) || 0;
  }

  const accType = (accountType || "").toLowerCase();
  const curr = (currency || "").toUpperCase();

  // Convert Cent / USC to USD
  if (accType.includes("cent") || curr === "USC") {
    num = num / 100.0;
  }
  // Convert IDR to USD
  else if (curr === "IDR") {
    num = num / 15500.0;
  }

  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

/**
 * Evaluate Institutional Audit Status & Kick Decision based on USD balance
 */
export function evaluateInstitutionalStatus(
  cleanBal: number,
  accountType: string
): {
  status: string;
  kickDecision: "RED" | "YELLOW" | "SAFE";
  isDemo: boolean;
} {
  const accType = (accountType || "").toLowerCase();
  const isDemo = accType.includes("demo");

  let status = "ACTIVE";
  if (cleanBal <= 0) {
    status = "MC";
  } else if (cleanBal < 30.0) {
    status = "LOW BALANCE";
  } else if (cleanBal >= 100.0) {
    status = "VALID VIP INDICATOR";
  } else if (cleanBal >= 50.0) {
    status = "VALID VIP";
  } else {
    status = "ACTIVE";
  }

  let kickDecision: "RED" | "YELLOW" | "SAFE" = "SAFE";
  if (isDemo) {
    kickDecision = "YELLOW";
  } else if (cleanBal < 30.0) {
    // Both MC (<=0) and LOW BALANCE (<30) lead to RED / KICK
    kickDecision = "RED";
  } else {
    kickDecision = "SAFE";
  }

  return { status, kickDecision, isDemo };
}

/**
 * Live Broker API Fetcher for single Meta Account
 */
export async function fetchLiveBrokerAccount(valetaxId: string) {
  const cacheBuster = Date.now();
  const url = `https://ma.valetax.com/api.external.partner.findByMetaAccount?token=${VALETAX_TOKEN_NORMALIZED}&login=${encodeURIComponent(
    valetaxId
  )}&_ts=${cacheBuster}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "OwlAlgo-AuditStudio/2.0",
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
    clearTimeout(timeoutId);

    if (res.status === 404) {
      return { found: false, code: 404, message: "Account not found on broker API" };
    }

    if (res.status === 429) {
      return {
        found: false,
        error: "Rate limit broker dicapai (429). Sila tunggu sebentar dan cuba lagi.",
      };
    }

    if (!res.ok) {
      return {
        found: false,
        error: `Ralat HTTP dari broker (${res.status}).`,
      };
    }

    const text = await res.text();
    if (!text || !text.trim()) {
      return {
        found: false,
        message: `Valetax ID [${valetaxId}] tidak ditemui pada sistem broker.`,
      };
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        found: false,
        message: `Valetax ID [${valetaxId}] tidak ditemui pada sistem broker.`,
      };
    }

    if (!json || json.status === "error" || json.error) {
      return {
        found: false,
        message: json?.message || json?.error || "Account not found on broker API",
      };
    }

    const payload = json.data || json;

    // Verify minimum required fields for account existence
    if (
      typeof payload.balance === "undefined" &&
      typeof payload.login === "undefined" &&
      typeof payload.email === "undefined"
    ) {
      return { found: false, message: "Empty account record returned by broker" };
    }

    const rawBal = payload.balance ?? 0;
    const rawEq = payload.equity ?? rawBal;
    const accountType = String(payload.accountType || payload.type || "").trim();
    const currency = String(payload.currency || "USD").trim().toUpperCase();

    const cleanBal = standardizeBalance(rawBal, accountType, currency);
    const cleanEq = standardizeBalance(rawEq, accountType, currency);
    const { status, kickDecision, isDemo } = evaluateInstitutionalStatus(
      cleanBal,
      accountType
    );

    return {
      found: true,
      data: {
        valetaxId: String(payload.login || valetaxId),
        balance: cleanBal,
        equity: cleanEq,
        rawBalance: rawBal,
        accountType: accountType || "Standard",
        currency: currency || "USD",
        accountName: payload.accountName || payload.name || "",
        directPartnerEmail: payload.directPartnerEmail || payload.email || "",
        status,
        kickDecision,
        isDemo,
      },
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return {
        found: false,
        error: "Sambungan ke broker API tamat masa (Timeout 12s). Sila cuba lagi.",
      };
    }
    return {
      found: false,
      error: `Ralat sambungan: ${err.message}`,
    };
  }
}

/**
 * On-Demand Sync to Supabase vip_clients table
 */
export async function syncValetaxRecordToSupabase(payload: {
  valetaxId: string;
  balance: number;
  equity?: number;
  status: string;
  remark?: string;
}) {
  const { valetaxId, balance, equity, status, remark } = payload;
  const cleanId = String(valetaxId).trim();

  if (!cleanId) {
    throw new Error("Valetax ID diperlukan untuk sinkronisasi.");
  }

  const updateFields: Record<string, any> = {
    balance: Number(balance),
    status: String(status),
    last_update: new Date().toISOString(),
  };

  if (typeof equity === "number") {
    updateFields.equity = Number(equity);
  }

  const { data, error } = await supabase
    .from("vip_clients")
    .update(updateFields)
    .eq("valetax_id", cleanId)
    .select();

  if (error) {
    throw new Error(`Supabase Update Error: ${error.message}`);
  }

  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cache-Control, Pragma");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { action, valetaxId, balance, equity, status, remark } = req.body || {};

  // Action 1: On-demand sync to Supabase
  if (action === "sync-db") {
    try {
      const data = await syncValetaxRecordToSupabase({
        valetaxId,
        balance,
        equity,
        status,
        remark,
      });
      return res.status(200).json({
        success: true,
        message: `Rekod ${valetaxId} berjaya diselaraskan ke Supabase.`,
        data,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Action 2: Direct Live Broker API Polling (Default)
  const idToSearch = String(valetaxId || "").trim();
  if (!idToSearch) {
    return res.status(400).json({
      success: false,
      error: "Valetax ID diperlukan.",
    });
  }

  const brokerResult = await fetchLiveBrokerAccount(idToSearch);

  if (!brokerResult.found) {
    return res.status(200).json({
      success: false,
      found: false,
      error: brokerResult.error,
      message: `⚠️ Valetax ID [${idToSearch}] not found on broker API`,
    });
  }

  return res.status(200).json({
    success: true,
    found: true,
    data: brokerResult.data,
  });
}
