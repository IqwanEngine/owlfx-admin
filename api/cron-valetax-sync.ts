/* =============================================================================
 * IqwanEngine v4.4 — Vercel Cron Background Valetax Synchronizer
 * Endpoint   : /api/cron-valetax-sync (Vercel Serverless & Node.js Express)
 * Purpose    : Continuous 15-minute batch polling of vip_clients table
 * Safety     : Strict IPv4, Rate-Limit Delay (60ms), 60s Timeout Guard, Zero False Kicks
 * =============================================================================
 */

import https from "node:https";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Vercel Serverless Execution Directives
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for batch processing
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

const VALETAX_TOKEN_NORMALIZED = getNormalizedToken(RAW_VALETAX_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Native IPv4 HTTPS request to prevent Cloudflare/Broker timeouts
 */
function fetchValetaxIPv4(urlStr: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "GET",
        family: 4, // Strict IPv4 resolution
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        timeout: 8000,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode || 200, text: data });
        });
      });

      req.on("timeout", () => {
        req.destroy(new Error("Timeout (8s)"));
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Standardize balance and equity to standard USD (Cent / IDR conversion)
 */
function standardizeBalance(rawVal: any, accountType: string, currency: string): number {
  if (rawVal === "-" || rawVal === null || rawVal === undefined) return 0;
  let num: number =
    typeof rawVal === "number"
      ? isNaN(rawVal)
        ? 0
        : rawVal
      : parseFloat(String(rawVal).trim().replace(/[^0-9.-]/g, "")) || 0;

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
 * Evaluates institutional trader status based on clean USD balance
 */
function evaluateStatus(cleanBal: number): string {
  if (cleanBal <= 0) return "MC";
  if (cleanBal < 30.0) return "LOW BALANCE";
  if (cleanBal >= 100.0) return "VALID VIP INDICATOR";
  if (cleanBal >= 50.0) return "VALID VIP";
  return "ACTIVE";
}

/**
 * Core Batch Synchronization Worker
 */
export async function executeValetaxCronSync(maxBatchSize = 80): Promise<{
  success: boolean;
  processed: number;
  updated: number;
  skipped: number;
  elapsedMs: number;
  message?: string;
}> {
  const startTime = Date.now();
  const MAX_SAFE_RUNTIME_MS = 22000; // 22 seconds max

  // 1. Fetch oldest 200 records by last_update (nullsFirst ensures untouched rows sync first)
  const { data: traders, error } = await supabase
    .from("vip_clients")
    .select("id, valetax_id, account_type, currency, status, balance")
    .not("valetax_id", "is", null)
    .neq("valetax_id", "-")
    .neq("valetax_id", "")
    .order("last_update", { ascending: true, nullsFirst: true })
    .limit(maxBatchSize);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  if (!traders || traders.length === 0) {
    return {
      success: true,
      processed: 0,
      updated: 0,
      skipped: 0,
      elapsedMs: Date.now() - startTime,
      message: "No traders pending synchronization.",
    };
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < traders.length; i++) {
    // Timeout Safeguard: break early if approaching serverless execution limit
    if (Date.now() - startTime > MAX_SAFE_RUNTIME_MS) {
      console.log(
        `[CRON] Approaching 22s limit, breaking loop early to return 200 OK cleanly. Processed ${i}/${traders.length} traders.`
      );
      break;
    }

    const trader = traders[i];
    const rawId = String(trader.valetax_id || "").trim();

    if (!rawId || rawId === "-" || rawId === "0") {
      // Empty or invalid valetax_id: bump last_update so it does not starve the queue
      await supabase
        .from("vip_clients")
        .update({
          status: "NOT VALID",
          last_update: new Date().toISOString(),
        })
        .eq("id", trader.id);
      updatedCount++;
      continue;
    }

    try {
      const cacheBuster = Date.now();
      const url = `https://ma.valetax.com/api.external.partner.findByMetaAccount?token=${VALETAX_TOKEN_NORMALIZED}&login=${encodeURIComponent(
        rawId
      )}&_ts=${cacheBuster}`;

      const { status: httpStatus, text } = await fetchValetaxIPv4(url);

      // 1. Transient network / rate limit / 5xx error
      if (httpStatus === 429 || httpStatus >= 500) {
        // Even on transient errors, we bump last_update to ensure queue rotation
        await supabase
          .from("vip_clients")
          .update({
            last_update: new Date().toISOString(),
          })
          .eq("id", trader.id);

        updatedCount++;
        await sleep(150); // Pause slightly longer on rate limits
        continue;
      }

      // 2. HTTP 404: Broker explicitly confirmed account does not exist
      if (httpStatus === 404) {
        await supabase
          .from("vip_clients")
          .update({
            status: "NOT VALID",
            last_update: new Date().toISOString(),
          })
          .eq("id", trader.id);

        updatedCount++;
        await sleep(65);
        continue;
      }

      // 3. Empty body from Valetax (Broker returns HTTP 200 with "" when Meta account is not found under partner)
      const trimmedText = (text || "").trim();
      if (!trimmedText) {
        await supabase
          .from("vip_clients")
          .update({
            status: "NOT VALID",
            last_update: new Date().toISOString(),
          })
          .eq("id", trader.id);

        updatedCount++;
        await sleep(65);
        continue;
      }

      // 4. Parse JSON
      let json: any = null;
      try {
        json = JSON.parse(trimmedText);
      } catch {
        // Unexpected non-JSON response from broker: bump last_update to prevent queue starvation
        await supabase
          .from("vip_clients")
          .update({
            last_update: new Date().toISOString(),
          })
          .eq("id", trader.id);
        updatedCount++;
        await sleep(65);
        continue;
      }

      // 5. Broker returned error payload (e.g. { error: "Account not found" })
      if (!json || json.status === "error" || json.error) {
        const errMsg = String(json?.message || json?.error || "").toLowerCase();
        if (
          errMsg.includes("not found") ||
          errMsg.includes("invalid login") ||
          errMsg.includes("does not exist") ||
          errMsg.includes("not belong")
        ) {
          await supabase
            .from("vip_clients")
            .update({
              status: "NOT VALID",
              last_update: new Date().toISOString(),
            })
            .eq("id", trader.id);
        } else {
          // Other broker notice: bump last_update to ensure queue rotation
          await supabase
            .from("vip_clients")
            .update({
              last_update: new Date().toISOString(),
            })
            .eq("id", trader.id);
        }
        updatedCount++;
        await sleep(65);
        continue;
      }

      // 6. Valid account data returned from broker!
      const accData = json.data || json;
      if (typeof accData.balance !== "undefined" || typeof accData.email !== "undefined") {
        const accType = accData.accountType || accData.account_type || trader.account_type || "";
        const curr = accData.currency || trader.currency || "USD";

        const cleanBal = standardizeBalance(accData.balance, accType, curr);
        const cleanEq = standardizeBalance(accData.equity ?? accData.balance, accType, curr);
        const newStatus = evaluateStatus(cleanBal);

        // ALWAYS update last_update (even if balance is unchanged!) so queue rotates forward
        await supabase
          .from("vip_clients")
          .update({
            balance: cleanBal,
            equity: cleanEq,
            status: newStatus,
            last_update: new Date().toISOString(),
          })
          .eq("id", trader.id);

        updatedCount++;
      } else {
        // Fallback: bump last_update to prevent queue starvation
        await supabase
          .from("vip_clients")
          .update({
            last_update: new Date().toISOString(),
          })
          .eq("id", trader.id);
        updatedCount++;
      }
    } catch (err) {
      // Catch network failures (timeout, socket hangup)
      // Bump last_update even on failure to ensure queue rotation
      try {
        await supabase
          .from("vip_clients")
          .update({
            last_update: new Date().toISOString(),
          })
          .eq("id", trader.id);
        updatedCount++;
      } catch (innerErr) {
        console.error("[CRON] Failed to update last_update after fetch error:", innerErr);
        skippedCount++;
      }
    }

    // Gentle pacing delay between broker calls (50ms - 80ms)
    await sleep(65);
  }

  const elapsedMs = Date.now() - startTime;
  return {
    success: true,
    processed: updatedCount + skippedCount,
    updated: updatedCount,
    skipped: skippedCount,
    elapsedMs,
  };
}

/**
 * Standard Handler for Vercel Serverless & Node Express
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Security Check: Vercel CRON_SECRET authorization
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as
    | string
    | undefined;

  if (
    cronSecret &&
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized cron execution",
    });
  }

  try {
    const summary = await executeValetaxCronSync(80);
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error("[IqwanEngine Cron Sync Error]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to execute cron sync",
    });
  }
}

/**
 * Next.js App Router Support (GET / POST)
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (
    cronSecret &&
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized cron execution" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const summary = await executeValetaxCronSync(80);
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
