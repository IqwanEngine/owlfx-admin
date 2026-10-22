/* Powered by IqwanEngine */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MY_ENDPOINT = (
  process.env.GOOGLE_SHEETS_MY_ENDPOINT ||
  process.env.VITE_GOOGLE_SHEETS_MY_ENDPOINT ||
  ""
).trim().replace(/^["']|["']$/g, '');
const ID_ENDPOINT = (
  process.env.GOOGLE_SHEETS_ID_ENDPOINT ||
  process.env.VITE_GOOGLE_SHEETS_ID_ENDPOINT ||
  "https://script.google.com/macros/s/AKfycbxK0G2aOhYNy5WalUQjImp4aReiTGfgEEKBR61Q7Lunjm_zCybglbpPU1iVL5J8r--z/exec"
).trim().replace(/^["']|["']$/g, '');
const ADMIN_KEY = (process.env.ADMIN_DASHBOARD_KEY || "IE_Admin#Gold2026!Master").trim().replace(/^["']|["']$/g, '');

function getCleanUrl(endpoint: string, action = "fetch") {
  if (!endpoint) return "";
  const clean = endpoint.trim().replace(/^["']|["']$/g, '');
  return (
    clean.split("?")[0] +
    `?action=${action}&key=${encodeURIComponent(ADMIN_KEY)}`
  );
}

async function fetchGAS(url: string) {
  const cleanUrl = getCleanUrl(url, "fetch");
  if (!cleanUrl) return [];

  try {
    const res = await fetch(cleanUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) throw new Error(`GAS fetch failed with status: ${res.status}`);

    const json = await res.json();
    if (json && json.success === false)
      throw new Error(json.message || "GAS reported failure");

    return Array.isArray(json.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];
  } catch (err) {
    console.error("GAS Fetch error:", err);
    return [];
  }
}

async function fetchSupabaseMY() {
  let allRecords: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("vip_clients")
      .select("*")
      .order("id", { ascending: false })
      .range(from, from + step - 1);

    if (error) {
      console.error("Supabase fetch error:", error);
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      allRecords = allRecords.concat(data);
      if (data.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

function normalize(raw: any, country: "MY" | "ID", index: number) {
  const rowIdx = raw.row_index ?? raw.rowIndex ?? index + 7;
  const traderName = String(raw.trader_name || "UNKNOWN TRADER")
    .trim()
    .toUpperCase();
  const contactNumber = String(raw.contact_number || "-").trim();
  const registerEmail = String(raw.register_email || "")
    .trim()
    .toLowerCase();
  const tradingViewUsername = String(raw.trading_view_username || "-").trim();
  const valetaxId = String(raw.valetax_id || "-").trim();
  const registerDate = raw.register_date ? String(raw.register_date) : "";
  const serviceDays = String(raw.service_days ?? "-");
  const updatedBy = String(raw.updated_by || "System Form");
  const level = Number(raw.level) || 1;
  const directPartnerEmail = String(raw.direct_partner_email || "-").trim();
  const balance =
    typeof raw.balance === "number"
      ? raw.balance
      : parseFloat(String(raw.balance || "0").replace(/[^0-9.-]+/g, "")) || 0;
  const equity =
    typeof raw.equity === "number"
      ? raw.equity
      : parseFloat(String(raw.equity || "0").replace(/[^0-9.-]+/g, "")) || 0;
  const credit =
    typeof raw.credit === "number"
      ? raw.credit
      : parseFloat(String(raw.credit || "0").replace(/[^0-9.-]+/g, "")) || 0;
  const margin =
    typeof raw.margin === "number"
      ? raw.margin
      : parseFloat(String(raw.margin || "0").replace(/[^0-9.-]+/g, "")) || 0;
  const leverage = Number(raw.leverage) || 100;
  const accountName = String(raw.account_name || "-");
  const accountType = String(raw.account_type || "-");
  const server = String(raw.server || "-");
  const platform = String(raw.platform || "meta4");
  const dateOfCreation = raw.date_of_creation
    ? String(raw.date_of_creation)
    : "";
  const currency = String(raw.currency || "USD").toUpperCase();
  const status = String(raw.status || "Active").trim();

  let lastUpdateFormatted = "-";
  const rawW =
    raw.updated_time || raw.last_update || raw.updated_time_col_w || raw.col_w;
  if (
    rawW &&
    String(rawW).trim() !== "" &&
    String(rawW).trim() !== "-" &&
    String(rawW).trim() !== "undefined"
  ) {
    lastUpdateFormatted = String(rawW).trim();
  }

  let registerDateFormatted = "-";
  if (registerDate) {
    try {
      const d = new Date(registerDate);
      if (!isNaN(d.getTime())) {
        registerDateFormatted = d.toLocaleString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Kuala_Lumpur",
        });
      }
    } catch {}
  }

  return {
    id: `${country}-${rowIdx}-${valetaxId || Math.random().toString(36).substring(2, 7)}`,
    rowIndex: rowIdx,
    traderName,
    contactNumber,
    registerEmail,
    tradingViewUsername,
    valetaxId,
    registerDate,
    serviceDays,
    updatedBy,
    level,
    directPartnerEmail,
    balance,
    equity,
    credit,
    margin,
    leverage,
    accountName,
    accountType,
    server,
    platform,
    dateOfCreation,
    currency,
    status,
    country,
    lastUpdateFormatted,
    registerDateFormatted,
    raw,
  };
}

function calculateCountryMetrics(traders: any[], country: "MY" | "ID") {
  const statusCounts = {
    active: 0,
    lowBal: 0,
    mc: 0,
    notValid: 0,
    validVip: 0,
    validVipIndicator: 0,
    other: 0,
    total: traders.length,
  };

  const totalBalanceUSD = traders.reduce((acc, trader) => {
    let rawStr = (trader.balance || "").toString().replace(/,/g, "").trim();
    let num = parseFloat(rawStr) || 0;
    const accType = (trader.accountType || "").toLowerCase();
    const curr = (trader.currency || "").toUpperCase();

    if (accType.includes("cent") || curr === "USC") num = num / 100.0;
    else if (curr === "IDR") num = num / 15500.0;

    return acc + num;
  }, 0);

  for (const t of traders) {
    const s = (t.status || "").trim().toUpperCase();
    if (s === "VALID VIP INDICATOR" || s.includes("VIP INDICATOR"))
      statusCounts.validVipIndicator++;
    else if (s === "VALID VIP" || s.includes("VIP")) statusCounts.validVip++;
    else if (s === "ACTIVE" || s === "VALID") statusCounts.active++;
    else if (s.includes("LOW")) statusCounts.lowBal++;
    else if (s === "MC" || s.includes("MARGIN CALL")) statusCounts.mc++;
    else if (s.includes("NOT") || s.includes("INVALID"))
      statusCounts.notValid++;
    else statusCounts.other++;
  }

  return {
    country,
    countryName: country === "MY" ? "Malaysia" : "Indonesia",
    totalTraders: traders.length,
    totalBalanceUSD,
    statusBreakdown: statusCounts,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // =========================================================================
  // 1. PENGENDALIAN POST: TICK / VERIFY / UPDATE / DELETE / AUDIT ENGINE
  // =========================================================================
  if (req.method === "POST") {
    try {
      const body = req.body || {};
      const targetAction = body.action || "update_col_w";

      // =========================================================================
      // IQWANENGINE v4.0: 2-WEEK INSTITUTIONAL AUDIT ENGINE HANDLER
      // =========================================================================
      if (targetAction === "audit_engine") {
        const allTraders = await fetchSupabaseMY(); // Tarik semua rekod siap pagination

        const tvGroup: Record<string, any[]> = {};
        allTraders.forEach((t) => {
          const tvUser = (
            t.trading_view_username ||
            t.tradingViewUsername ||
            ""
          ).trim();
          if (!tvUser || tvUser === "-" || tvUser.toLowerCase() === "username")
            return;
          if (!tvGroup[tvUser]) tvGroup[tvUser] = [];
          tvGroup[tvUser].push(t);
        });

        const detailedRows: any[] = [];
        const kickListForScript: string[] = [];

        Object.keys(tvGroup).forEach((tvUser) => {
          const accounts = tvGroup[tvUser];

          const validAccounts = accounts.filter((acc) => {
            const s = (acc.status || "").trim().toUpperCase();
            const type = (acc.account_type || acc.accountType || "")
              .trim()
              .toLowerCase();
            return (
              !type.includes("demo") &&
              (s === "ACTIVE" ||
                s === "LOW BALANCE" ||
                s === "VALID VIP" ||
                s === "VALID VIP INDICATOR")
            );
          });

          const onlyHasDemo = accounts.every((acc) => {
            const type = (acc.account_type || acc.accountType || "")
              .trim()
              .toLowerCase();
            return type.includes("demo");
          });

          let overallDecision: "RED" | "YELLOW" | "SAFE" = "SAFE";
          if (validAccounts.length === 0) {
            overallDecision = onlyHasDemo ? "YELLOW" : "RED";
            kickListForScript.push(tvUser);
          }

          accounts.forEach((acc) => {
            let numBal =
              typeof acc.balance === "number"
                ? acc.balance
                : parseFloat(String(acc.balance || "0").replace(/,/g, "")) || 0;
            const accType = (
              acc.account_type ||
              acc.accountType ||
              ""
            ).toLowerCase();
            const curr = (acc.currency || "USD").toUpperCase();

            if (accType.includes("cent") || curr === "USC")
              numBal = numBal / 100.0;
            else if (curr === "IDR") numBal = numBal / 15500.0;

            const statusBefore = acc.status || "Active";
            let statusAfter = "ACTIVE";
            if (numBal <= 0) statusAfter = "MC";
            else if (numBal < 30.0) statusAfter = "LOW BALANCE";
            else if (numBal >= 100.0) statusAfter = "VALID VIP INDICATOR";
            else if (numBal >= 50.0) statusAfter = "VALID VIP";

            let remark = "Normal";
            if (accType.includes("demo")) {
              remark = "Demo Account";
            } else if (numBal > 0 && statusBefore === statusAfter) {
              remark = "Parking Modal";
            }

            detailedRows.push({
              id: acc.id,
              trader_name: acc.trader_name || acc.traderName || "-",
              contact_number: acc.contact_number || acc.contactNumber || "-",
              trading_view_username: tvUser,
              valetax_id: acc.valetax_id || acc.valetaxId || "-",
              direct_partner_email:
                acc.direct_partner_email || acc.directPartnerEmail || "-",
              balance: numBal.toFixed(2),
              account_type: acc.account_type || acc.accountType || "-",
              currency: curr,
              status_before: statusBefore,
              status_after: statusAfter,
              remark: remark,
              kick_decision: overallDecision,
            });
          });
        });

        const uniqueKickTVs = Array.from(new Set(kickListForScript));

        // Format Skrip TradingView Siap Pakai
        const generatedScript = `/**
 * Generated by IqwanEngine — Production Direct API Bulk Revoker
 * Target Users to Kick: ${uniqueKickTVs.length}
 */
(async function IqwanEngine_batchRemoveViaAPI() {
  "use strict";
  const ENDPOINT = "https://www.tradingview.com/pine_perm/remove/";
  const SCRIPT_ID = "PUB;bbda3b9754e1478e95ff80d543b8a6e4";
  const RATE_LIMIT_MS = 600;
  const MAX_RETRIES = 3;
  const rawList = ${JSON.stringify(uniqueKickTVs, null, 2)};
  const targetUsers = Array.from(new Set(rawList.map(u => u.trim()).filter(Boolean)));
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  async function removeOne(username, attempt) {
    attempt = attempt || 1;
    try {
      const payload = new URLSearchParams();
      payload.append("pine_id", SCRIPT_ID);
      payload.append("username_recip", username);
      const res = await fetch(ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Language": "en",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: payload.toString()
      });
      if (res.status === 429 && attempt <= MAX_RETRIES) {
        await sleep(RATE_LIMIT_MS * attempt * 2);
        return removeOne(username, attempt + 1);
      }
      if (!res.ok) return { username, ok: false, status: res.status };
      return { username, ok: true, status: res.status };
    } catch (err) {
      if (attempt <= MAX_RETRIES) {
        await sleep(RATE_LIMIT_MS * attempt);
        return removeOne(username, attempt + 1);
      }
      return { username, ok: false, error: String(err) };
    }
  }
  console.log("%c[IqwanEngine] Memulakan pemadaman untuk " + targetUsers.length + " pengguna...", "color:#00ff99;font-weight:bold;");
  for (let i = 0; i < targetUsers.length; i++) {
    const res = await removeOne(targetUsers[i]);
    console.log("[" + (i+1) + "/" + targetUsers.length + "] " + targetUsers[i] + " — " + (res.ok ? "BERJAYA DIBUANG" : "GAGAL"));
    await sleep(RATE_LIMIT_MS);
  }
  console.log("%c[IqwanEngine] SELESAI!", "color:#00ffff;font-weight:bold;");
})();`;

        // Rekod snapshot ke audit_history di Supabase
        try {
          await supabase.from("audit_history").insert({
            total_scanned: detailedRows.length,
            total_safe: detailedRows.filter((r) => r.kick_decision === "SAFE")
              .length,
            total_kicked: uniqueKickTVs.length,
            kick_list: {
              total_kicked: uniqueKickTVs.length,
              kicked_users: uniqueKickTVs,
            },
          });
        } catch (histErr) {
          console.error("Audit history insert error:", histErr);
        }

        return res.status(200).json({
          success: true,
          summary: {
            totalAccounts: detailedRows.length,
            totalSafe: detailedRows.filter((r) => r.kick_decision === "SAFE")
              .length,
            totalRedKick: detailedRows.filter((r) => r.kick_decision === "RED")
              .length,
            totalYellowKick: detailedRows.filter(
              (r) => r.kick_decision === "YELLOW",
            ).length,
            uniqueKickCount: uniqueKickTVs.length,
          },
          detailedRows,
          generatedScript,
        });
      }
      // =========================================================================

      const targetCountry = (body.country || body.region || "MY").toUpperCase();
      const targetValetaxId = String(
        body.valetax_id || body.valetaxId || "",
      ).trim();
      const targetDateOfCreation = String(
        body.dateOfCreation || body.date_of_creation || "",
      ).trim();
      const targetRow = Number(body.row_index || body.rowIndex) || 0;

      // Format timestamp GMT+8
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const m: Record<string, string> = {};
      for (const p of parts) m[p.type] = p.value;
      const gmt8Time = `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
      const finalTimestamp = body.timestamp || gmt8Time;

      // A. KEMAS KINI SUPABASE (KHAS UNTUK MALAYSIA SAHAJA)
      if (targetCountry === "MY") {
        if (targetAction === "delete") {
          // Buang terus dari Supabase (atau kemas kini status kepada Deleted)
          let q = supabase.from("vip_clients").delete();
          if (targetDateOfCreation && targetDateOfCreation !== "-") {
            await q.eq("date_of_creation", targetDateOfCreation);
          } else if (targetValetaxId && targetValetaxId !== "-") {
            await q.eq("valetax_id", targetValetaxId);
          }
        } else if (targetAction === "update" && body.updateData) {
          let q = supabase.from("vip_clients").update(body.updateData);
          if (targetDateOfCreation && targetDateOfCreation !== "-") {
            await q.eq("date_of_creation", targetDateOfCreation);
          } else if (targetValetaxId && targetValetaxId !== "-") {
            await q.eq("valetax_id", targetValetaxId);
          }
        } else if (
          targetAction === "update_col_w" ||
          targetAction === "verify"
        ) {
          let q = supabase
            .from("vip_clients")
            .update({ last_update: finalTimestamp });
          if (targetDateOfCreation && targetDateOfCreation !== "-") {
            await q.eq("date_of_creation", targetDateOfCreation);
          } else if (targetValetaxId && targetValetaxId !== "-") {
            await q.eq("valetax_id", targetValetaxId);
          }
        }
      }

      // B. KEMAS KINI GOOGLE SHEETS
      const endpoint = targetCountry === "ID" ? ID_ENDPOINT : MY_ENDPOINT;
      if (endpoint) {
        const cleanBase = endpoint.split("?")[0];

        try {
          await fetch(cleanBase, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: targetAction,
              valetax_id: targetValetaxId,
              valetaxId: targetValetaxId,
              date_of_creation: targetDateOfCreation,
              dateOfCreation: targetDateOfCreation,
              rowIndex: targetRow,
              row_index: targetRow,
              timestamp: finalTimestamp,
              updateData: body.updateData,
            }),
          });
        } catch (gasErr: any) {
          const gasGetUrl = `${cleanBase}?action=update_col_w&dateOfCreation=${encodeURIComponent(
            targetDateOfCreation,
          )}&valetax_id=${encodeURIComponent(
            targetValetaxId,
          )}&rowIndex=${targetRow}&timestamp=${encodeURIComponent(
            finalTimestamp,
          )}&key=${encodeURIComponent(ADMIN_KEY)}`;
          fetch(gasGetUrl, {
            method: "GET",
            headers: { "User-Agent": "OwlAlgo-IqwanEngine/2.0" },
          }).catch(() => {});
        }
      }

      return res.status(200).json({
        success: true,
        updatedTime: finalTimestamp,
        valetaxId: targetValetaxId,
        dateOfCreation: targetDateOfCreation,
        country: targetCountry,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // =========================================================================
  // 2. PENGENDALIAN GET: TARIK DATA LENGKAP & SEJARAH AUDIT
  // =========================================================================
  try {
    const action = req.query.action as string;

    // Tarik arkib sejarah untuk Modal Studio
    if (action === "fetch_history" || action === "audit_history") {
      const { data: histData, error: histErr } = await supabase
        .from("audit_history")
        .select("*")
        .order("audit_date", { ascending: false })
        .limit(20);

      if (histErr) throw histErr;
      return res.status(200).json({ success: true, history: histData || [] });
    }

    const region = req.query.region as string;

    const sortFn = (a: any, b: any) => {
      const timeA = a.registerDate ? new Date(a.registerDate).getTime() : 0;
      const timeB = b.registerDate ? new Date(b.registerDate).getTime() : 0;
      return (timeB || 0) - (timeA || 0);
    };

    if (region === "MY") {
      const rawMY = await fetchSupabaseMY();
      const myTraders = rawMY.map((r, i) => normalize(r, "MY", i)).sort(sortFn);
      const myMetrics = calculateCountryMetrics(myTraders, "MY");
      return res.status(200).json({
        success: true,
        data: { malaysia: myTraders },
        metrics: { malaysia: myMetrics },
      });
    }

    if (region === "ID") {
      const rawID = await fetchGAS(ID_ENDPOINT);
      const idTraders = rawID.map((r, i) => normalize(r, "ID", i)).sort(sortFn);
      const idMetrics = calculateCountryMetrics(idTraders, "ID");
      return res.status(200).json({
        success: true,
        data: { indonesia: idTraders },
        metrics: { indonesia: idMetrics },
      });
    }

    const [rawMY, rawID] = await Promise.all([
      fetchSupabaseMY(),
      fetchGAS(ID_ENDPOINT),
    ]);

    const myTraders = rawMY.map((r, i) => normalize(r, "MY", i)).sort(sortFn);
    const idTraders = rawID.map((r, i) => normalize(r, "ID", i)).sort(sortFn);

    const myMetrics = calculateCountryMetrics(myTraders, "MY");
    const idMetrics = calculateCountryMetrics(idTraders, "ID");

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        malaysia: myTraders,
        indonesia: idTraders,
      },
      metrics: {
        malaysia: myMetrics,
        indonesia: idMetrics,
        combined: {
          totalTraders: myTraders.length + idTraders.length,
          totalBalanceUSD:
            myMetrics.totalBalanceUSD + idMetrics.totalBalanceUSD,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
