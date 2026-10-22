/* =============================================================================
 * IqwanEngine v4.2 — Cloud Audit Engine & Live Valetax Synchronizer
 * Architecture : Direct Supabase & Valetax High-Speed Synchronizer (Hardened)
 * Purpose      : Live API Polling with Rate-Limit Resilience & Balance Safeguard
 * =============================================================================
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const RAW_VALETAX_TOKEN =
  process.env.VALETAX_STATIC_TOKEN ||
  process.env.VALETAX_API_TOKEN ||
  "eyJpZCI6OTg0NjI5LCJ1c2VySWQiOjQ4NjA2LCJ0eXBlIjoic3RhdGljIiwibWZhVmVyaWZpZWQiOmZhbHNlLCJwYXNzd29yZFZlcmlmaWVkIjpmYWxzZX0o0NREtbnwV%2FjRfVaw2bqwAo3vjRqT%2BUuVvpXjq6DCrg%3D%3D";

function getNormalizedToken(token: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(token));
  } catch {
    return encodeURIComponent(token);
  }
}

const VALETAX_TOKEN = getNormalizedToken(RAW_VALETAX_TOKEN);
const ADMIN_KEY = process.env.ADMIN_DASHBOARD_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * DATA SAFEGUARD: Standardize Currency & Clean Balance
 * Converts Cent/USC (divide by 100) and IDR (divide by 15,500) to standard USD.
 */
function cleanBalance(
  balanceRaw: any,
  accountType: string,
  currency: string,
): number {
  if (balanceRaw === "-" || balanceRaw === null || balanceRaw === undefined) {
    return 0;
  }

  let num: number;
  if (typeof balanceRaw === "number") {
    num = isNaN(balanceRaw) ? 0 : balanceRaw;
  } else {
    const cleaned = String(balanceRaw).trim().replace(/[^0-9.-]/g, "");
    num = parseFloat(cleaned) || 0;
  }

  const accType = (accountType || "").toLowerCase();
  const curr = (currency || "").toUpperCase();

  // Convert Cent / USC to USD
  if (accType.includes("cent") || curr === "USC") {
    num = num / 100.0;
  }
  // Convert Indonesian Rupiah (IDR) to USD
  else if (curr === "IDR") {
    num = num / 15500.0;
  }

  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

/**
 * Evaluates account status based on USD-standardized balance
 */
function evaluateStatus(
  balanceRaw: string | number,
  accountType: string,
  currency: string,
) {
  const cleanNum = cleanBalance(balanceRaw, accountType, currency);

  let status = "ACTIVE";
  if (cleanNum <= 0) status = "MC";
  else if (cleanNum < 30.0) status = "LOW BALANCE";
  else if (cleanNum >= 100.0) status = "VALID VIP INDICATOR";
  else if (cleanNum >= 50.0) status = "VALID VIP";

  return { status, cleanBalance: cleanNum };
}

/**
 * Helper to sleep for rate limiting
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safe fetcher with rate limit backoff and transient error classification
 */
async function fetchValetaxAccount(valetaxId: string, maxRetries = 2) {
  const url = `https://ma.valetax.com/api.external.partner.findByMetaAccount?token=${VALETAX_TOKEN}&login=${encodeURIComponent(valetaxId)}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      // 429 Too Many Requests -> Backoff and retry
      if (res.status === 429) {
        if (attempt < maxRetries) {
          await sleep(800 * (attempt + 1));
          continue;
        }
        return { type: "RATE_LIMITED", status: 429 };
      }

      // 401 or 403 Unauthorized -> Token expired / invalid
      if (res.status === 401 || res.status === 403) {
        return { type: "AUTH_ERROR", status: res.status };
      }

      // 5xx Server Outage -> Transient error, do NOT mark account invalid
      if (res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        return { type: "SERVER_ERROR", status: res.status };
      }

      // 404 -> Meta account explicitly not found on Valetax
      if (res.status === 404) {
        return { type: "NOT_FOUND", status: 404 };
      }

      if (!res.ok) {
        return { type: "HTTP_ERROR", status: res.status };
      }

      const json = await res.json();

      // Check if Valetax returns a JSON-wrapped error
      if (json && (json.status === "error" || json.error)) {
        const errMsg = String(json.message || json.error || "").toLowerCase();
        if (
          errMsg.includes("not found") ||
          errMsg.includes("invalid login") ||
          errMsg.includes("does not exist")
        ) {
          return { type: "NOT_FOUND", data: json };
        }
        // Other API errors (e.g. rate limit, maintenance)
        return { type: "API_ERROR", data: json };
      }

      return { type: "SUCCESS", data: json.data || json };
    } catch (err: any) {
      if (attempt < maxRetries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      return { type: "NETWORK_TIMEOUT", error: err.message };
    }
  }

  return { type: "FAILED" };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { key, limit = 100, offset = 0 } = req.body || {};
  if (ADMIN_KEY && key !== ADMIN_KEY) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized IqwanEngine Access" });
  }

  // Enforce safe bounds for Supabase limits (max 1000 per range)
  const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 1000);
  const safeOffset = Math.max(0, Number(offset) || 0);

  try {
    // =========================================================================
    // 1. DATA SAFEGUARD: Deterministic Pagination with ORDER BY id
    // Prevents rows from skipping or duplicating across sequential audit offsets.
    // Filters out null, dash, and empty valetax_ids.
    // =========================================================================
    const {
      data: traders,
      error,
      count,
    } = await supabase
      .from("vip_clients")
      .select(
        "id, valetax_id, trader_name, trading_view_username, account_type, currency, status, balance",
        { count: "exact" },
      )
      .not("valetax_id", "is", null)
      .neq("valetax_id", "-")
      .neq("valetax_id", "")
      .order("id", { ascending: true }) // Deterministic ordering
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) throw error;

    if (!traders || traders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Semua trader telah selesai diaudit.",
        done: true,
        processed: 0,
        totalCount: count ?? 0,
      });
    }

    const kickList: any[] = [];
    const timestamp = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date())
      .replace(",", "");

    // =========================================================================
    // 2. LIVE VALETAX SYNC WITH NETWORK / ERROR SAFEGUARD
    // - Concurrency pool (batches of 10) to prevent rate limits
    // - Does NOT mark accounts as "NOT VALID" on 429, 5xx, or network timeouts
    // - Stores standardized USD balance (cleanBalance) to prevent Cent/IDR corruption
    // =========================================================================
    const CHUNK_SIZE = 10;
    for (let i = 0; i < traders.length; i += CHUNK_SIZE) {
      const chunk = traders.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (trader) => {
          // Validate and sanitize valetax_id
          const rawId = String(trader.valetax_id || "").trim();
          if (!rawId || rawId === "-" || rawId === "0") {
            return;
          }

          const fetchResult = await fetchValetaxAccount(rawId);

          // CASE A: Account explicitly not found on broker -> Mark NOT VALID
          if (fetchResult.type === "NOT_FOUND") {
            await supabase
              .from("vip_clients")
              .update({
                status: "NOT VALID",
                last_update: timestamp,
              })
              .eq("id", trader.id);

            kickList.push({
              tv: (trader.trading_view_username || "").trim(),
              reason: "NOT VALID (Broker Confirmed)",
              name: trader.trader_name,
              valetaxId: rawId,
            });
            return;
          }

          // CASE B: Transient network error / Rate Limit (429) / Token issue / Server 5xx
          // CRITICAL SAFEGUARD: Do NOT overwrite account status to NOT VALID!
          if (
            fetchResult.type === "RATE_LIMITED" ||
            fetchResult.type === "AUTH_ERROR" ||
            fetchResult.type === "SERVER_ERROR" ||
            fetchResult.type === "NETWORK_TIMEOUT" ||
            fetchResult.type === "API_ERROR" ||
            fetchResult.type === "FAILED"
          ) {
            console.warn(
              `[IqwanEngine Audit Notice] Valetax ID ${rawId} skipped due to ${fetchResult.type}. Retaining current status.`,
            );
            return; // Skip update to preserve data integrity
          }

          // CASE C: Success -> Live balance received from Valetax
          if (fetchResult.type === "SUCCESS" && fetchResult.data) {
            const acc = fetchResult.data;

            if (typeof acc.email !== "undefined" || typeof acc.balance !== "undefined") {
              const accType = acc.accountType || trader.account_type || "";
              const curr = acc.currency || trader.currency || "USD";

              const { status: newStatus, cleanBalance: stdBal } = evaluateStatus(
                acc.balance,
                accType,
                curr,
              );

              const stdEquity = cleanBalance(acc.equity ?? acc.balance, accType, curr);

              // =============================================================
              // CRITICAL SAFEGUARD: Write standardized USD balance to Supabase!
              // NEVER write raw Cent (e.g. 50,000 cents) or raw IDR values!
              // =============================================================
              await supabase
                .from("vip_clients")
                .update({
                  balance: stdBal.toFixed(2), // Standardized USD amount
                  equity: stdEquity.toFixed(2), // Standardized USD equity
                  account_type: accType || trader.account_type,
                  currency: curr,
                  status: newStatus,
                  last_update: timestamp,
                })
                .eq("id", trader.id);

              if (
                newStatus === "LOW BALANCE" ||
                newStatus === "MC" ||
                newStatus === "NOT VALID"
              ) {
                kickList.push({
                  tv: (trader.trading_view_username || "").trim(),
                  reason: newStatus,
                  name: trader.trader_name,
                  valetaxId: rawId,
                });
              }
            }
          }
        }),
      );

      // Gentle pause between chunks to respect broker rate limits
      if (i + CHUNK_SIZE < traders.length) {
        await sleep(150);
      }
    }

    const isDone =
      traders.length < safeLimit ||
      (count !== null && safeOffset + traders.length >= count);

    return res.status(200).json({
      success: true,
      done: isDone,
      processed: traders.length,
      nextOffset: safeOffset + traders.length,
      totalCount: count ?? null,
      kickList,
    });
  } catch (err: any) {
    console.error("[IqwanEngine Cloud Audit Error]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
