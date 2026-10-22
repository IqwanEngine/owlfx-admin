import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  RefreshCw,
  X,
  Copy,
  Check,
  Search,
  ShieldCheck,
  AlertTriangle,
  UserX,
  History,
  Activity,
  Layers,
  Database,
  Calendar,
  Clock,
  Filter,
  CheckCircle2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Play,
  Crosshair,
  Save,
  Zap,
  Radio,
  Download,
  Terminal,
} from "lucide-react";

export interface TraderRecord {
  id?: string | number;
  valetaxId?: string | number;
  valetax_id?: string | number;
  traderName?: string;
  trader_name?: string;
  contactNumber?: string;
  contact_number?: string;
  tradingViewUsername?: string;
  trading_view_username?: string;
  directPartnerEmail?: string;
  direct_partner_email?: string;
  balance?: string | number;
  previous_balance?: string | number;
  previousBalance?: string | number;
  accountType?: string;
  account_type?: string;
  currency?: string;
  status?: string;
  raw?: {
    trading_view_username?: string;
    previous_balance?: string | number;
    previousBalance?: string | number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface AuditRow {
  id: string | number;
  trader_name: string;
  contact_number: string;
  trading_view_username: string;
  valetax_id: string;
  direct_partner_email: string;
  balance: string;
  account_type: string;
  currency: string;
  status_before: string;
  status_after: string;
  remark: string;
  kick_decision: "RED" | "YELLOW" | "ALREADY_KICKED" | "SAFE";
  original_index: number;
  isLiveBrokerSynced?: boolean;
  syncedToDb?: boolean;
}

interface ManualBrokerResult {
  valetaxId: string;
  balance: number;
  equity: number;
  rawBalance: any;
  accountType: string;
  currency: string;
  accountName: string;
  directPartnerEmail: string;
  status: string;
  statusBefore: string;
  kickDecision: "RED" | "YELLOW" | "SAFE";
  isDemo: boolean;
  traderName: string;
  tradingViewUsername: string;
  contactNumber: string;
  isLocalMatch: boolean;
  isSynced: boolean;
  multiAccountNotice?: string;
}

interface AuditSummary {
  totalAccounts?: number;
  totalSafe?: number;
  totalRedKick?: number;
  totalYellowKick?: number;
  totalAlreadyKicked?: number;
  uniqueKickCount?: number;
}

interface AuditHistoryItem {
  id: string | number;
  audit_date: string;
  total_scanned: number;
  total_safe: number;
  total_kicked: number;
  notes?: string;
  csv_content?: string;
  csv_data?: string;
}

interface AuditStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  traders?: TraderRecord[];
}

const STORAGE_KEY = "owlalgo_audit_history_v4";
const PAGE_SIZE = 100;

/**
 * Format timestamp strictly to Asia/Kuala_Lumpur GMT+8
 */
function formatGMT8(dateStr: string): { date: string; time: string; full: string } {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return { date: dateStr || "-", time: "GMT+8", full: `${dateStr} GMT+8` };
    }
    const dateFormatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
    const timeFormatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
    return {
      date: dateFormatted,
      time: `${timeFormatted} GMT+8`,
      full: `${dateFormatted}, ${timeFormatted} GMT+8`,
    };
  } catch {
    return { date: dateStr || "-", time: "GMT+8", full: `${dateStr} GMT+8` };
  }
}

/**
 * Parse previous balances from the most recent historical snapshot
 */
function extractPreviousBalancesFromHistory(
  snapshots: AuditHistoryItem[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (!snapshots || snapshots.length === 0) return map;

  const latest = snapshots[0];
  const csv =
    latest.csv_content ||
    (latest.csv_data
      ? decodeURI(latest.csv_data.replace(/^data:text\/csv;charset=utf-8,/, ""))
      : "");
  if (!csv) return map;

  const lines = csv.split("\n");
  if (lines.length <= 1) return map;

  const header = lines[0]
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  const valetaxIdx = header.findIndex((h) => h.includes("valetax"));
  const balanceIdx = header.findIndex((h) => h.includes("balance"));

  if (valetaxIdx === -1 || balanceIdx === -1) return map;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells: string[] = [];
    let inQuote = false;
    let currentCell = "";
    for (let char of line) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === "," && !inQuote) {
        cells.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());

    const vid = (cells[valetaxIdx] || "").replace(/^"|"$/g, "").trim();
    const balStr = (cells[balanceIdx] || "")
      .replace(/^"|"$/g, "")
      .replace(/[^0-9.-]+/g, "");
    const balNum = parseFloat(balStr);
    if (vid && vid !== "-" && !isNaN(balNum)) {
      map.set(vid, balNum);
    }
  }

  return map;
}

export const AuditStudioModal: React.FC<AuditStudioModalProps> = ({
  isOpen,
  onClose,
  traders = [],
}) => {
  const [activeTab, setActiveTab] = useState<"AUDIT" | "HISTORY">("AUDIT");
  const [hasStartedAudit, setHasStartedAudit] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentScanningName, setCurrentScanningName] = useState<string>("");
  const [scanStatsLive, setScanStatsLive] = useState({
    scanned: 0,
    safe: 0,
    kick: 0,
  });

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [manualValetaxId, setManualValetaxId] = useState<string>("");
  const [isManualChecking, setIsManualChecking] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualCheckResult, setManualCheckResult] =
    useState<ManualBrokerResult | null>(null);
  const [syncingValetaxId, setSyncingValetaxId] = useState<string | null>(null);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState<boolean>(false);
  const [syncFeedbackToast, setSyncFeedbackToast] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState<string>("");
  const [filterKick, setFilterKick] = useState<
    "ALL" | "RED" | "YELLOW" | "PARKING" | "ALREADY_KICKED" | "SAFE"
  >("ALL");

  const [currentPage, setCurrentPage] = useState<number>(1);

  const [auditData, setAuditData] = useState<{
    summary?: AuditSummary;
    detailedRows?: AuditRow[];
    generatedScript?: string;
  }>({});

  const [historyList, setHistoryList] = useState<AuditHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const scriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scriptTimeoutRef.current) clearTimeout(scriptTimeoutRef.current);
      if (fieldTimeoutRef.current) clearTimeout(fieldTimeoutRef.current);
    };
  }, []);

  const updateHistoryStorage = (newList: AuditHistoryItem[]) => {
    try {
      setHistoryList(newList);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch (err) {
      console.error("LocalStorage write failed:", err);
    }
  };

  // Fetch historical snapshots from Supabase on mount or when opening History tab
  const fetchSupabaseHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/audit-engine?action=fetch_history");
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.success && Array.isArray(json.history)) {
        // Merge Supabase history with local storage history, deduplicating by id / timestamp
        const dbItems: AuditHistoryItem[] = json.history.map((h: any) => ({
          id: h.id || h.audit_date,
          audit_date: h.audit_date || h.created_at || new Date().toISOString(),
          total_scanned: h.total_scanned ?? 0,
          total_safe: h.total_safe ?? 0,
          total_kicked: h.total_kicked ?? 0,
          notes: h.notes || "Snapshot 2 Minggu",
          csv_content: h.csv_content || "",
        }));

        setHistoryList((prev) => {
          const map = new Map<string, AuditHistoryItem>();
          // Put DB items first
          dbItems.forEach((item) => {
            const key = String(item.audit_date).slice(0, 19);
            map.set(key, item);
          });
          // Merge local items if not already present
          prev.forEach((item) => {
            const key = String(item.audit_date).slice(0, 19);
            if (!map.has(key)) map.set(key, item);
          });
          const merged = Array.from(map.values()).sort(
            (a, b) =>
              new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime(),
          );
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    } catch {
      // Gracefully fall back to localStorage
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSupabaseHistory();
    }
  }, [isOpen, fetchSupabaseHistory]);

  useEffect(() => {
    if (!isOpen) {
      setHasStartedAudit(false);
      setIsScanning(false);
      setAuditData({});
      setSearch("");
      setFilterKick("ALL");
      setCurrentPage(1);
    }
  }, [isOpen]);

  /**
   * 1. INSTITUTIONAL AUDIT ENGINE
   * - Strictly READ-ONLY during evaluation (Zero Auto-Mutation to Supabase).
   * - Preserves "Status Asal" strictly as stored in the DB.
   * - Computes "Status Audit" with positive balances upgraded from NOT VALID.
   * - Precision Parking Modal evaluation (only if balance === previousBalance && balance > 0).
   */
  const executeInstitutionalAudit = useCallback(async () => {
    if (!traders || traders.length === 0) return;
    setIsScanning(true);
    setScanProgress(0);
    setHasStartedAudit(true);
    setScanStatsLive({ scanned: 0, safe: 0, kick: 0 });

    const previousBalanceMap = extractPreviousBalancesFromHistory(historyList);
    const total = traders.length;
    const chunkSize = 40;

    let liveSafeCount = 0;
    let liveKickCount = 0;

    for (let i = 0; i < total; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize, total);
      const currentTrader = traders[i];
      const vid =
        currentTrader?.valetaxId || currentTrader?.valetax_id || "-";
      const tname =
        currentTrader?.traderName || currentTrader?.trader_name || "Trader";

      setCurrentScanningName(`[ID: ${vid}] ${tname}`);
      const prog = Math.round((chunkEnd / total) * 100);
      setScanProgress(prog);

      // Estimate live radar telemetry counts
      for (let j = i; j < chunkEnd; j++) {
        const bal =
          typeof traders[j].balance === "number"
            ? (traders[j].balance as number)
            : parseFloat(
                String(traders[j].balance || "0").replace(/[^0-9.-]+/g, ""),
              ) || 0;
        if (bal >= 30) liveSafeCount++;
        else liveKickCount++;
      }
      setScanStatsLive({
        scanned: chunkEnd,
        safe: liveSafeCount,
        kick: liveKickCount,
      });

      await new Promise((res) => setTimeout(res, 6));
    }

    // Grouping by TradingView username (case-insensitive deduplication)
    const tvGroup: Record<
      string,
      {
        displayTV: string;
        accounts: (TraderRecord & { __originalIndex: number })[];
      }
    > = {};

    traders.forEach((t, idx) => {
      const rawTV = (
        t.tradingViewUsername ||
        t.trading_view_username ||
        t.raw?.trading_view_username ||
        ""
      ).trim();

      const lowerTV = rawTV.toLowerCase();
      if (
        !rawTV ||
        rawTV === "-" ||
        lowerTV === "username" ||
        lowerTV === "n/a" ||
        lowerTV === "none" ||
        lowerTV === "nil" ||
        lowerTV === "null" ||
        lowerTV === "undefined"
      ) {
        return;
      }

      if (!tvGroup[lowerTV]) {
        tvGroup[lowerTV] = {
          displayTV: rawTV,
          accounts: [],
        };
      }
      tvGroup[lowerTV].accounts.push({ ...t, __originalIndex: idx });
    });

    const detailedRows: AuditRow[] = [];
    const kickListMap = new Map<string, string>();

    Object.keys(tvGroup).forEach((normKey) => {
      const { displayTV, accounts } = tvGroup[normKey];

      const evaluatedAccounts = accounts.map((acc) => {
        let numBal =
          typeof acc.balance === "number"
            ? acc.balance
            : parseFloat(
                String(acc.balance || "0").replace(/[^0-9.-]+/g, ""),
              ) || 0;
        const accType = (
          acc.accountType ||
          acc.account_type ||
          ""
        ).toLowerCase();
        const curr = (acc.currency || "USD").toUpperCase();

        // Standard Cent (/100) and IDR (/15500) conversions to standard USD
        if (accType.includes("cent") || curr === "USC") numBal = numBal / 100.0;
        else if (curr === "IDR") numBal = numBal / 15500.0;
        numBal = Number.isFinite(numBal) ? Math.round(numBal * 100) / 100 : 0;

        // "Status Asal": strictly preserved from DB
        const statusBefore = (acc.status || "Active").trim();

        // "Status Audit": evaluated from live balance
        let statusAfter = "ACTIVE";
        if (numBal <= 0) {
          if (statusBefore.toUpperCase().includes("NOT VALID")) {
            statusAfter = "NOT VALID";
          } else {
            statusAfter = "MC";
          }
        } else if (numBal < 30.0) {
          statusAfter = "LOW BALANCE";
        } else if (numBal >= 100.0) {
          statusAfter = "VALID VIP INDICATOR";
        } else if (numBal >= 50.0) {
          statusAfter = "VALID VIP";
        } else {
          statusAfter = "ACTIVE";
        }

        const isDemo = accType.includes("demo");

        // Parking Modal Logic: ONLY tag if balance === previousBalance && balance > 0
        const vid = String(acc.valetaxId || acc.valetax_id || "").trim();
        const prevBalDirect =
          (acc as any).previous_balance ??
          (acc as any).previousBalance ??
          acc.raw?.previous_balance ??
          acc.raw?.previousBalance;
        let previousBalance: number | undefined = undefined;
        if (
          prevBalDirect !== undefined &&
          prevBalDirect !== null &&
          prevBalDirect !== ""
        ) {
          const parsed =
            typeof prevBalDirect === "number"
              ? prevBalDirect
              : parseFloat(String(prevBalDirect).replace(/[^0-9.-]+/g, ""));
          if (Number.isFinite(parsed)) previousBalance = parsed;
        }
        if (previousBalance === undefined && vid && previousBalanceMap.has(vid)) {
          previousBalance = previousBalanceMap.get(vid);
        }

        const isParkingModal =
          previousBalance !== undefined &&
          Number.isFinite(previousBalance) &&
          numBal > 0 &&
          Math.abs(numBal - previousBalance) < 0.001;

        let remark = "Normal";
        if (isDemo) {
          remark = "Demo Account";
        } else if (
          statusBefore.toUpperCase().includes("NOT VALID") &&
          numBal > 0
        ) {
          remark = "Pulih (Akaun Aktif)";
        } else if (
          statusBefore.toUpperCase().includes("NOT VALID") &&
          numBal <= 0
        ) {
          remark = "Not Valid Lama";
        } else if (numBal <= 0) {
          remark = "Baki Kosong ($0)";
        } else if (isParkingModal) {
          remark = "Parking Modal";
        } else {
          remark = "Normal";
        }

        return {
          acc,
          numBal,
          curr,
          accType,
          statusBefore,
          statusAfter,
          isDemo,
          remark,
        };
      });

      const validAccounts = evaluatedAccounts.filter((ev) => {
        return (
          !ev.isDemo &&
          (ev.statusAfter === "VALID VIP" ||
            ev.statusAfter === "VALID VIP INDICATOR" ||
            ev.statusAfter === "ACTIVE")
        );
      });

      const onlyHasDemo = evaluatedAccounts.every((ev) => ev.isDemo);
      const isPersistentNotValid =
        validAccounts.length === 0 &&
        evaluatedAccounts.every(
          (ev) =>
            ev.statusBefore.toUpperCase().includes("NOT VALID") &&
            ev.numBal <= 0,
        );

      let overallDecision: "RED" | "YELLOW" | "ALREADY_KICKED" | "SAFE" =
        "SAFE";

      if (validAccounts.length > 0) {
        overallDecision = "SAFE";
      } else if (isPersistentNotValid) {
        overallDecision = "ALREADY_KICKED";
      } else if (onlyHasDemo) {
        overallDecision = "YELLOW";
        kickListMap.set(normKey, displayTV);
      } else {
        overallDecision = "RED";
        kickListMap.set(normKey, displayTV);
      }

      evaluatedAccounts.forEach((ev) => {
        const { acc, numBal, curr, statusBefore, statusAfter, remark } = ev;
        detailedRows.push({
          id:
            acc.id ||
            `${normKey}-${acc.valetaxId || acc.valetax_id || Math.random()}`,
          trader_name: acc.traderName || acc.trader_name || "-",
          contact_number: acc.contactNumber || acc.contact_number || "-",
          trading_view_username: displayTV,
          valetax_id: String(acc.valetaxId || acc.valetax_id || "-").trim(),
          direct_partner_email:
            acc.directPartnerEmail || acc.direct_partner_email || "-",
          balance: numBal.toFixed(2),
          account_type: acc.accountType || acc.account_type || "-",
          currency: curr,
          status_before: statusBefore,
          status_after: statusAfter,
          remark: remark,
          kick_decision: overallDecision,
          original_index: acc.__originalIndex ?? 0,
        });
      });
    });

    detailedRows.sort((a, b) => a.original_index - b.original_index);
    const uniqueKickTVs = Array.from(kickListMap.values());

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
  console.log("%c[IqwanEngine] Memulakan pemadaman untuk " + targetUsers.length + " pengguna unik...", "color:#00ff99;font-weight:bold;");
  for (let i = 0; i < targetUsers.length; i++) {
    const res = await removeOne(targetUsers[i]);
    console.log("[" + (i+1) + "/" + targetUsers.length + "] " + targetUsers[i] + " — " + (res.ok ? "BERJAYA DIBUANG" : "GAGAL"));
    await sleep(RATE_LIMIT_MS);
  }
  console.log("%c[IqwanEngine] SELESAI!", "color:#00ffff;font-weight:bold;");
})();`;

    setAuditData({
      summary: {
        totalAccounts: detailedRows.length,
        totalSafe: detailedRows.filter((r) => r.kick_decision === "SAFE")
          .length,
        totalRedKick: detailedRows.filter((r) => r.kick_decision === "RED")
          .length,
        totalYellowKick: detailedRows.filter(
          (r) => r.kick_decision === "YELLOW",
        ).length,
        totalAlreadyKicked: detailedRows.filter(
          (r) => r.kick_decision === "ALREADY_KICKED",
        ).length,
        uniqueKickCount: uniqueKickTVs.length,
      },
      detailedRows,
      generatedScript,
    });

    setIsScanning(false);
    setCurrentPage(1);
  }, [traders, historyList]);

  /**
   * 2. MANUAL VALETAX CHECK VIA /api/manual-check
   * Supports wrapped ({ found: true, data: { ... } }) and flat JSON payloads.
   * Standardizes Cent (/100) and IDR (/15500) to 2 decimal places.
   */
  const handleExecuteManualCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const idToSearch = manualValetaxId.trim();
    if (!idToSearch) return;

    setIsManualChecking(true);
    setManualError(null);
    setManualCheckResult(null);

    try {
      const res = await fetch("/api/manual-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify({ valetaxId: idToSearch }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        throw new Error(
          `Respons pelayan tidak sah (${res.status} ${res.statusText})`,
        );
      }

      // Handle both wrapped and flat structures
      const rawData = json?.data || json;
      const isBrokerValid =
        Boolean(json?.found || json?.success) ||
        (rawData &&
          (rawData.email !== undefined ||
            rawData.balance !== undefined ||
            rawData.accountType !== undefined ||
            rawData.account_type !== undefined ||
            rawData.login !== undefined ||
            rawData.valetaxId !== undefined));

      if (!res.ok || !isBrokerValid || !rawData || json?.found === false) {
        setManualError(
          json?.message ||
            json?.error ||
            `⚠️ Valetax ID [${idToSearch}] tidak ditemui pada sistem broker API`,
        );
        return;
      }

      const balRaw = rawData.balance ?? 0;
      let numBal =
        typeof balRaw === "number"
          ? balRaw
          : parseFloat(String(balRaw).replace(/[^0-9.-]+/g, "")) || 0;

      const eqRaw = rawData.equity ?? balRaw;
      let numEq =
        typeof eqRaw === "number"
          ? eqRaw
          : parseFloat(String(eqRaw).replace(/[^0-9.-]+/g, "")) || 0;

      const accType = String(
        rawData.accountType || rawData.account_type || rawData.type || "",
      ).toLowerCase();
      const curr = String(rawData.currency || "USD").toUpperCase();

      // Standardize Cent / USC and IDR
      if (accType.includes("cent") || curr === "USC") {
        numBal = numBal / 100.0;
        numEq = numEq / 100.0;
      } else if (curr === "IDR") {
        numBal = numBal / 15500.0;
        numEq = numEq / 15500.0;
      }

      numBal = Number.isFinite(numBal) ? Math.round(numBal * 100) / 100 : 0;
      numEq = Number.isFinite(numEq) ? Math.round(numEq * 100) / 100 : 0;

      const localMatch = traders.find(
        (t) => String(t.valetaxId || t.valetax_id || "").trim() === idToSearch,
      );
      const statusBefore = (localMatch?.status || "NOT VALID").trim();

      const isDemo = accType.includes("demo");
      let calculatedStatus = "ACTIVE";
      let kickDecision: "RED" | "YELLOW" | "SAFE" = "SAFE";

      if (isDemo) {
        calculatedStatus = "DEMO";
        kickDecision = "YELLOW";
      } else if (numBal <= 0) {
        calculatedStatus = "MC";
        kickDecision = "RED";
      } else if (numBal < 30.0) {
        calculatedStatus = "LOW BALANCE";
        kickDecision = "RED";
      } else if (numBal >= 100.0) {
        calculatedStatus = "VALID VIP INDICATOR";
        kickDecision = "SAFE";
      } else if (numBal >= 50.0) {
        calculatedStatus = "VALID VIP";
        kickDecision = "SAFE";
      } else {
        calculatedStatus = "ACTIVE";
        kickDecision = "SAFE";
      }

      const traderName =
        localMatch?.traderName ||
        localMatch?.trader_name ||
        rawData.accountName ||
        rawData.name ||
        "Trader Manual";
      const contactNumber =
        localMatch?.contactNumber || localMatch?.contact_number || "-";
      const tvUsername = (
        localMatch?.tradingViewUsername ||
        localMatch?.trading_view_username ||
        localMatch?.raw?.trading_view_username ||
        "-"
      ).trim();
      const directPartnerEmail =
        rawData.directPartnerEmail ||
        rawData.direct_partner_email ||
        localMatch?.directPartnerEmail ||
        localMatch?.direct_partner_email ||
        "-";

      // Multi-Account Cross-Checking Safeguard
      const lowerTV = tvUsername.toLowerCase();
      const hasValidTV =
        tvUsername &&
        tvUsername !== "-" &&
        lowerTV !== "username" &&
        lowerTV !== "n/a" &&
        lowerTV !== "none" &&
        lowerTV !== "nil" &&
        lowerTV !== "null" &&
        lowerTV !== "undefined";

      let hasOtherActiveAccount = false;
      let multiAccountNotice: string | undefined = undefined;

      if (hasValidTV) {
        // Query all peer accounts in traders prop sharing this exact trading_view_username
        const peerAccounts = traders.filter((t) => {
          const peerTV = (
            t.tradingViewUsername ||
            t.trading_view_username ||
            t.raw?.trading_view_username ||
            ""
          ).trim().toLowerCase();
          const peerId = String(t.valetaxId || t.valetax_id || "").trim();
          return peerTV === lowerTV && peerId !== idToSearch;
        });

        // Evaluate peer statuses: Does this trader possess at least ONE other non-demo account with ACTIVE, VALID VIP, or VALID VIP INDICATOR?
        for (const peer of peerAccounts) {
          const peerAccType = String(
            peer.accountType || peer.account_type || "",
          ).toLowerCase();
          const isPeerDemo = peerAccType.includes("demo");
          if (isPeerDemo) continue;

          let peerBal =
            typeof peer.balance === "number"
              ? peer.balance
              : parseFloat(String(peer.balance || "0").replace(/[^0-9.-]+/g, "")) || 0;
          const peerCurr = String(peer.currency || "USD").toUpperCase();
          if (peerAccType.includes("cent") || peerCurr === "USC") {
            peerBal = peerBal / 100.0;
          } else if (peerCurr === "IDR") {
            peerBal = peerBal / 15500.0;
          }

          const peerStatus = String(peer.status || "").trim().toUpperCase();

          const isPeerValidStatus =
            peerStatus === "ACTIVE" ||
            peerStatus === "VALID VIP" ||
            peerStatus === "VALID VIP INDICATOR" ||
            peerBal >= 30.0;

          if (isPeerValidStatus) {
            hasOtherActiveAccount = true;
            break;
          }
        }

        // If trader has at least one other active qualifying account, override kick decision to SAFE
        if (hasOtherActiveAccount && kickDecision === "RED") {
          kickDecision = "SAFE";
          multiAccountNotice = "SELAMAT (Multi-Akaun: Mempunyai akaun aktif lain)";
        }
      }

      let remark = isDemo ? "Demo Account" : "Live Broker Synced";
      if (multiAccountNotice) {
        remark = multiAccountNotice;
      } else if (statusBefore.toUpperCase().includes("NOT VALID") && numBal > 0) {
        remark = "Pulih (Akaun Aktif)";
      }

      const liveRow: AuditRow = {
        id: `valetax-${idToSearch}`,
        trader_name: traderName,
        contact_number: contactNumber,
        trading_view_username: tvUsername,
        valetax_id: idToSearch,
        direct_partner_email: directPartnerEmail,
        balance: numBal.toFixed(2),
        account_type:
          rawData.accountType || rawData.account_type || rawData.type || "-",
        currency: curr,
        status_before: statusBefore,
        status_after: calculatedStatus,
        remark,
        kick_decision: kickDecision,
        original_index: 0,
        isLiveBrokerSynced: true,
        syncedToDb: false,
      };

      setManualCheckResult({
        valetaxId: idToSearch,
        balance: numBal,
        equity: numEq,
        rawBalance: balRaw,
        accountType:
          rawData.accountType || rawData.account_type || rawData.type || "-",
        currency: curr,
        accountName: rawData.accountName || traderName,
        directPartnerEmail,
        status: calculatedStatus,
        statusBefore,
        kickDecision,
        isDemo,
        traderName,
        tradingViewUsername: tvUsername,
        contactNumber,
        isLocalMatch: Boolean(localMatch),
        isSynced: false,
        multiAccountNotice,
      });

      // Update in-memory audit rows table immediately
      setAuditData((prev) => {
        const rows = prev.detailedRows ? [...prev.detailedRows] : [];
        const existingIdx = rows.findIndex(
          (r) => String(r.valetax_id).trim() === idToSearch,
        );

        if (existingIdx >= 0) {
          rows[existingIdx] = {
            ...rows[existingIdx],
            ...liveRow,
          };
        } else {
          rows.unshift(liveRow);
        }

        const totalSafe = rows.filter((r) => r.kick_decision === "SAFE").length;
        const totalRedKick = rows.filter(
          (r) => r.kick_decision === "RED",
        ).length;
        const totalYellowKick = rows.filter(
          (r) => r.kick_decision === "YELLOW",
        ).length;
        const totalAlreadyKicked = rows.filter(
          (r) => r.kick_decision === "ALREADY_KICKED",
        ).length;
        const uniqueKickTVs = Array.from(
          new Set(
            rows
              .filter((r) => r.kick_decision !== "SAFE")
              .map((r) => r.trading_view_username)
              .filter((tv) => tv && tv !== "-"),
          ),
        );

        return {
          ...prev,
          summary: {
            totalAccounts: rows.length,
            totalSafe,
            totalRedKick,
            totalYellowKick,
            totalAlreadyKicked,
            uniqueKickCount: uniqueKickTVs.length,
          },
          detailedRows: rows,
        };
      });

      setHasStartedAudit(true);
    } catch (err: any) {
      setManualError(
        `Ralat semasa menghubungi pelayan: ${err.message || "Sila cuba lagi."}`,
      );
    } finally {
      setIsManualChecking(false);
    }
  };

  /**
   * On-demand sync of a single evaluated row to Supabase
   */
  const handleSyncRowToDb = async (
    valetaxId: string,
    balance: number | string,
    status: string,
    equity?: number | string,
  ) => {
    const cleanId = String(valetaxId).trim();
    if (!cleanId) return;

    setSyncingValetaxId(cleanId);
    setSyncFeedbackToast(null);

    try {
      const cleanNumBal =
        typeof balance === "number"
          ? balance
          : parseFloat(String(balance).replace(/[^0-9.-]/g, "")) || 0;
      const cleanNumEq =
        equity !== undefined
          ? typeof equity === "number"
            ? equity
            : parseFloat(String(equity).replace(/[^0-9.-]/g, "")) || 0
          : undefined;

      // Call /api/manual-check with action sync-db
      const res = await fetch("/api/manual-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync-db",
          valetaxId: cleanId,
          balance: cleanNumBal,
          equity: cleanNumEq,
          status,
          remark: "Manual Live Sync",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengemaskini Supabase");
      }

      setAuditData((prev) => {
        if (!prev.detailedRows) return prev;
        const updated = prev.detailedRows.map((r) => {
          if (String(r.valetax_id).trim() === cleanId) {
            return {
              ...r,
              syncedToDb: true,
              remark: "Disimpan ke Supabase",
            };
          }
          return r;
        });
        return { ...prev, detailedRows: updated };
      });

      if (
        manualCheckResult &&
        String(manualCheckResult.valetaxId).trim() === cleanId
      ) {
        setManualCheckResult((prev) =>
          prev ? { ...prev, isSynced: true } : null,
        );
      }

      setSyncFeedbackToast(
        `✓ Rekod [${cleanId}] berjaya diselaraskan ke pangkalan data Supabase!`,
      );
      setTimeout(() => setSyncFeedbackToast(null), 4000);
    } catch (err: any) {
      setSyncFeedbackToast(`⚠️ Gagal simpan ke Supabase: ${err.message}`);
    } finally {
      setSyncingValetaxId(null);
    }
  };

  /**
   * 4. SAVE DATA SNAPSHOT & SYNC TO SUPABASE
   * Persists snapshot into Supabase audit_history table, syncs status changes to vip_clients,
   * and saves snapshot in localStorage for offline persistence.
   */
  const handleSaveSnapshot = async () => {
    if (!auditData?.summary || !auditData.detailedRows) return;

    setIsSavingSnapshot(true);
    const headers = [
      "Keputusan",
      "Trader Name",
      "Contact Number",
      "TradingView ID",
      "Valetax ID",
      "Partner Email",
      "Balance (USD)",
      "Status Sebelum",
      "Status Audit",
      "Catatan",
    ];
    const rowsCsv = auditData.detailedRows.map((r) => [
      `"${r.kick_decision}"`,
      `"${r.trader_name.replace(/"/g, '""')}"`,
      `"${r.contact_number.replace(/"/g, '""')}"`,
      `"${r.trading_view_username.replace(/"/g, '""')}"`,
      `"${r.valetax_id.replace(/"/g, '""')}"`,
      `"${r.direct_partner_email.replace(/"/g, '""')}"`,
      `"${r.balance}"`,
      `"${r.status_before.replace(/"/g, '""')}"`,
      `"${r.status_after.replace(/"/g, '""')}"`,
      `"${r.remark.replace(/"/g, '""')}"`,
    ]);

    const rawCsv = [headers.join(","), ...rowsCsv.map((e) => e.join(","))].join(
      "\n",
    );

    const newSnapshot: AuditHistoryItem = {
      id: Date.now(),
      audit_date: new Date().toISOString(),
      total_scanned: auditData.summary.totalAccounts || 0,
      total_safe: auditData.summary.totalSafe || 0,
      total_kicked: auditData.summary.uniqueKickCount || 0,
      notes: "Snapshot 2 Minggu",
      csv_content: rawCsv,
    };

    // Update localStorage immediately (guaranteed offline fallback)
    updateHistoryStorage([newSnapshot, ...historyList]);

    try {
      // Persist to Supabase audit_history and sync changed status to vip_clients
      const uniqueKickTVs = Array.from(
        new Set(
          auditData.detailedRows
            .filter((r) => r.kick_decision !== "SAFE")
            .map((r) => r.trading_view_username)
            .filter((tv) => tv && tv !== "-"),
        ),
      );

      const res = await fetch("/api/audit-engine?action=save_snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: auditData.summary,
          detailedRows: auditData.detailedRows,
          notes: "Snapshot 2 Minggu",
          csvContent: rawCsv,
          uniqueKickTVs,
        }),
      });

      const resJson = await res.json().catch(() => ({}));

      setSyncFeedbackToast(
        `✅ Snapshot berjaya disimpan ke Supabase audit_history! (${resJson?.syncedCount ?? 0} status disegerakkan)`,
      );
      setTimeout(() => setSyncFeedbackToast(null), 5000);
      fetchSupabaseHistory();
    } catch (err: any) {
      console.warn("Supabase save snapshot fallback notice:", err.message);
      setSyncFeedbackToast(
        `✅ Snapshot disimpan ke arkib tempatan! (Rangkaian awan: ${err.message})`,
      );
      setTimeout(() => setSyncFeedbackToast(null), 4000);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  /**
   * Export / Buka Sheet using Blob (URL.createObjectURL)
   */
  const handleDownloadSheet = (item: AuditHistoryItem) => {
    const content =
      item.csv_content ||
      (item.csv_data
        ? decodeURI(item.csv_data.replace(/^data:text\/csv;charset=utf-8,/, ""))
        : "");
    if (!content) {
      alert("Tiada data CSV tersedia untuk rekod ini.");
      return;
    }

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateSlug = item.audit_date ? item.audit_date.slice(0, 10) : "latest";
    link.download = `OWLALGO_Audit_Snapshot_${dateSlug}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDeleteSnapshot = (id: string | number) => {
    if (window.confirm("Padam rekod snapshot ini daripada storan?")) {
      updateHistoryStorage(historyList.filter((item) => item.id !== id));
    }
  };

  const handleClearAllHistory = () => {
    if (window.confirm("Padam SEMUA arkib snapshot sejarah?")) {
      updateHistoryStorage([]);
    }
  };

  const rows = useMemo(() => auditData?.detailedRows || [], [auditData]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchSearch =
        !s ||
        r.trader_name.toLowerCase().includes(s) ||
        r.trading_view_username.toLowerCase().includes(s) ||
        r.valetax_id.toLowerCase().includes(s) ||
        r.direct_partner_email.toLowerCase().includes(s);

      let matchKick = true;
      if (filterKick === "PARKING") matchKick = r.remark === "Parking Modal";
      else if (filterKick !== "ALL") matchKick = r.kick_decision === filterKick;

      return matchSearch && matchKick;
    });
  }, [rows, search, filterKick]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const handleCopyScript = async () => {
    if (!auditData?.generatedScript) return;
    try {
      await navigator.clipboard.writeText(auditData.generatedScript);
      setCopiedScript(true);
      if (scriptTimeoutRef.current) clearTimeout(scriptTimeoutRef.current);
      scriptTimeoutRef.current = setTimeout(() => setCopiedScript(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopySingle = async (text: string, identifier: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(identifier);
      if (fieldTimeoutRef.current) clearTimeout(fieldTimeoutRef.current);
      fieldTimeoutRef.current = setTimeout(() => setCopiedField(null), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const hasAuditedData = hasStartedAudit && rows.length > 0 && !isScanning;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-7xl h-[95vh] bg-[#0A0D14] border border-[#D4A017]/30 rounded-2xl flex flex-col shadow-[0_0_90px_rgba(212,175,55,0.15)] overflow-hidden font-sans">
        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-[#241D12] bg-[#0E121B] relative z-20">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 group">
              <div className="absolute inset-0 rounded-full border border-amber-500/30 pointer-events-none" />
              <picture className="w-full h-full block">
                <source srcSet="/OWLFXpng.webp" type="image/webp" />
                <img
                  src="/OWLFXpng.png"
                  alt="OWLFX Logo"
                  width="40"
                  height="40"
                  className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                />
              </picture>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-mono font-black text-sm tracking-wider uppercase">
                  OWL ALGO{" "}
                  <span className="text-[#D4A017]">— TRADINGVIEW FILTER</span>
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-[#D4A017]/10 text-[#D4A017] border border-[#D4A017]/30 tracking-widest">
                  Access Remove
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono tracking-wider flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-[#D4A017]" />
                IQWANENGINE AUTONOMOUS AUDITOR • TRADINGVIEW FILTER
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#07090D] p-1 rounded-xl border border-zinc-800/80">
              <button
                type="button"
                onClick={() => setActiveTab("AUDIT")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  activeTab === "AUDIT"
                    ? "bg-[#D4A017] text-black shadow-md font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                AUDIT LIVE
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("HISTORY");
                  fetchSupabaseHistory();
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  activeTab === "HISTORY"
                    ? "bg-[#D4A017] text-black shadow-md font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                HISTORY ({historyList.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* TAB 1: AUDIT LIVE */}
        {activeTab === "AUDIT" && (
          <div className="flex-1 flex flex-col p-3.5 sm:p-4 overflow-hidden gap-3">
            {/* 3. Initial Empty State: METRIC COUNTERS ALWAYS AT 0 BEFORE SCAN */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 font-mono">
              <div className="bg-gradient-to-b from-[#111622] to-[#0A0D14] border border-[#232B3E] p-3 rounded-xl">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                  Jumlah Rekod
                </span>
                <div className="text-xl font-black text-white mt-1">
                  {hasAuditedData
                    ? auditData?.summary?.totalAccounts?.toLocaleString()
                    : 0}
                </div>
                <div className="text-[9.5px] text-zinc-500 mt-0.5">
                  Semua akaun aktif
                </div>
              </div>

              <div className="bg-gradient-to-b from-[#0B1E19] to-[#0A0D14] border border-emerald-900/40 p-3 rounded-xl">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">
                  Selamat (Whitelist)
                </span>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {hasAuditedData
                    ? auditData?.summary?.totalSafe?.toLocaleString()
                    : 0}
                </div>
                <div className="text-[9.5px] text-emerald-500/70 mt-0.5">
                  Active Trade
                </div>
              </div>

              <div className="bg-gradient-to-b from-[#220D12] to-[#0A0D14] border border-rose-900/40 p-3 rounded-xl">
                <span className="text-[10px] text-rose-400 uppercase font-semibold block">
                  Kick Merah (MC Baru)
                </span>
                <div className="text-xl font-black text-rose-400 mt-1">
                  {hasAuditedData
                    ? auditData?.summary?.totalRedKick?.toLocaleString()
                    : 0}
                </div>
                <div className="text-[9.5px] text-rose-500/70 mt-0.5">
                  Akaun Kosong
                </div>
              </div>

              <div className="bg-gradient-to-b from-[#22180A] to-[#0A0D14] border border-amber-900/40 p-3 rounded-xl">
                <span className="text-[10px] text-amber-400 uppercase font-semibold block">
                  Kick Kuning (Demo)
                </span>
                <div className="text-xl font-black text-amber-400 mt-1">
                  {hasAuditedData
                    ? auditData?.summary?.totalYellowKick?.toLocaleString()
                    : 0}
                </div>
                <div className="text-[9.5px] text-amber-500/70 mt-0.5">
                  Demo Account Sahaja
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-[#261E09] to-[#0A0D14] border border-[#D4A017]/60 p-3 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.12)]">
                <span className="text-[10px] text-[#D4A017] uppercase font-bold tracking-wider block">
                  Total Kena Kick
                </span>
                <div className="text-2xl font-black text-[#D4A017] mt-1">
                  {hasAuditedData
                    ? auditData?.summary?.uniqueKickCount?.toLocaleString()
                    : 0}
                </div>
                <div className="text-[9.5px] text-[#D4A017]/80 mt-0.5 font-bold">
                  ID Unik Sahaja (Sifar Duplikasi)
                </div>
              </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 bg-[#0E121B] p-2 rounded-xl border border-[#212738]">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    disabled={!hasAuditedData}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Cari Trader, TradingView, atau Valetax ID..."
                    className="w-full bg-[#080B10] border border-zinc-800 text-white pl-9 pr-4 py-1.5 rounded-lg text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[#D4A017] disabled:opacity-40"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-[#080B10] border border-zinc-800 px-2.5 py-1.5 rounded-lg">
                  <Filter className="w-3 h-3 text-zinc-500" />
                  <select
                    disabled={!hasAuditedData}
                    value={filterKick}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      setFilterKick(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-zinc-300 text-xs font-mono focus:outline-none cursor-pointer pr-1 disabled:opacity-40"
                  >
                    <option value="ALL" className="bg-[#0A0D14] text-white">
                      Semua Status
                    </option>
                    <option value="RED" className="bg-[#0A0D14] text-rose-400">
                      🔴 KICK MERAH
                    </option>
                    <option
                      value="YELLOW"
                      className="bg-[#0A0D14] text-amber-300"
                    >
                      🟡 KICK KUNING
                    </option>
                    <option
                      value="PARKING"
                      className="bg-[#0A0D14] text-purple-300"
                    >
                      🟣 PARKING MODAL
                    </option>
                    <option
                      value="ALREADY_KICKED"
                      className="bg-[#0A0D14] text-zinc-400"
                    >
                      ⚪ SUDAH DIKICK
                    </option>
                    <option
                      value="SAFE"
                      className="bg-[#0A0D14] text-emerald-400"
                    >
                      🟢 SELAMAT
                    </option>
                  </select>
                </div>
              </div>

              {/* ACTION BUTTONS (Disabled until audit is executed) */}
              <div className="flex items-center gap-2 justify-end">
                {/* 2. Manual Valetax Check Button */}
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  title="Semak satu Valetax ID secara terus melalui API"
                  className="px-2.5 py-1.5 bg-[#171610] border border-[#D4A017]/60 text-[#D4A017] hover:bg-[#D4A017] hover:text-black rounded-lg text-xs font-bold font-mono flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                >
                  <Crosshair className="w-3 h-3" />
                  Manual
                </button>

                {/* 4. Save Data Snapshot Button */}
                <button
                  type="button"
                  disabled={!hasAuditedData || isSavingSnapshot}
                  onClick={handleSaveSnapshot}
                  className="px-3 py-1.5 bg-[#171610] border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-black rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                >
                  {isSavingSnapshot ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Data
                </button>

                {/* Re-Audit Button */}
                <button
                  type="button"
                  disabled={!hasAuditedData || isScanning}
                  onClick={executeInstitutionalAudit}
                  className="px-3 py-1.5 bg-[#14120B] border border-[#D4A017]/40 text-[#D4A017] hover:bg-[#D4A017] hover:text-black rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                >
                  <RefreshCw className="w-3 h-3" />
                  Re-Audit
                </button>

                {/* Kick TradingView Button */}
                <button
                  type="button"
                  disabled={
                    !hasAuditedData ||
                    (auditData?.summary?.uniqueKickCount || 0) === 0
                  }
                  onClick={handleCopyScript}
                  className="px-3.5 py-1.5 bg-[#D4A017] hover:bg-[#E5B226] text-black font-black font-mono rounded-lg text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(212,175,55,0.25)] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      DISALIN ({auditData?.summary?.uniqueKickCount || 0})
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      KICK TRADINGVIEW (
                      {auditData?.summary?.uniqueKickCount || 0})
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* TABLE / SCANNING / EMPTY STATE CONTAINER */}
            <div className="flex-1 overflow-hidden rounded-xl border border-[#212738] bg-[#080B10] flex flex-col relative">
              {/* 3. INITIAL EMPTY STATE: "PUSAT KAWALAN AUDIT 2 MINGGU" */}
              {!hasStartedAudit && !isScanning && (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center relative overflow-hidden bg-gradient-to-b from-zinc-950/60 via-zinc-900/40 to-zinc-950/80 backdrop-blur-xl">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.08),transparent_70%)] pointer-events-none" />
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

                  <div className="relative group mb-6">
                    <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-amber-500/20 via-yellow-400/10 to-amber-600/20 blur-xl opacity-70 group-hover:opacity-100 transition duration-500 pointer-events-none" />
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-b from-[#1A1408] to-zinc-900 border border-[#D4A017]/50 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.25)] relative">
                      <div className="absolute inset-0 rounded-2xl border border-amber-400/20 pointer-events-none" />
                      <picture className="w-12 h-12 block">
                        <source
                          srcSet="/OWLALGO-Trans.webp"
                          type="image/webp"
                        />
                        <img
                          src="/OWLALGO-Trans.webp"
                          alt="OWLFX Logo"
                          width="60"
                          height="60"
                          className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                        />
                      </picture>
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-white font-mono tracking-wider uppercase mb-3 bg-gradient-to-r from-white via-amber-100 to-zinc-400 bg-clip-text text-transparent">
                    PUSAT KAWALAN AUDIT 2 MINGGU
                  </h2>

                  <p className="text-xs text-zinc-400 max-w-md mb-8 font-mono leading-relaxed">
                    Owl Engines ready untuk mengaudit{" "}
                    <strong className="text-amber-400 font-bold">
                      {traders.length} rekod akaun
                    </strong>
                    . Semakan menyeluruh merangkumi penapisan akaun demo,
                    pengasingan status{" "}
                    <span className="text-red-400 font-semibold">
                      NOT VALID
                    </span>
                    , serta pemberian coding remove TradingView Access Manual.
                  </p>

                  <div className="grid grid-cols-3 gap-2.5 w-full max-w-md mb-8">
                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-center backdrop-blur-sm">
                      <div className="text-[10px] text-zinc-500 font-mono">
                        STATUS
                      </div>
                      <div className="text-xs font-bold text-amber-400 font-mono mt-0.5">
                        Fully Automation
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-center backdrop-blur-sm">
                      <div className="text-[10px] text-zinc-500 font-mono">
                        User
                      </div>
                      <div className="text-xs font-bold text-white font-mono mt-0.5">
                        {traders.length} Akaun
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-center backdrop-blur-sm">
                      <div className="text-[10px] text-zinc-500 font-mono">
                        I.E Coding
                      </div>
                      <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                        No Duplicate
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={executeInstitutionalAudit}
                    className="group relative px-8 py-3.5 bg-gradient-to-r from-[#D4A017] via-[#F3C677] to-[#D4A017] text-black font-black font-mono rounded-xl text-xs flex items-center gap-3 shadow-[0_0_35px_rgba(212,175,55,0.4)] hover:shadow-[0_0_50px_rgba(212,175,55,0.6)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/25 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                    <Play className="w-4 h-4 fill-black group-hover:rotate-12 transition-transform duration-300" />
                    <span>MULAKAN AUDIT RASMI</span>
                  </button>
                </div>
              )}

              {/* 3. GLOWING RADAR & TERMINAL SCAN HUD ANIMATION (CONFINED INSIDE TABLE AREA) */}
              {isScanning && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-[#06080D]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,160,23,0.06),transparent_75%)] pointer-events-none" />

                  {/* Concentric Radar Grid Display */}
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center my-2">
                    {/* Outer & inner concentric rings */}
                    <div className="absolute inset-0 rounded-full border border-[#D4A017]/20 shadow-[0_0_30px_rgba(212,160,23,0.1)]" />
                    <div className="absolute inset-8 rounded-full border border-[#D4A017]/25 border-dashed" />
                    <div className="absolute inset-16 rounded-full border border-[#D4A017]/30" />
                    <div className="absolute inset-24 rounded-full border border-[#D4A017]/40" />

                    {/* Crosshair coordinate lines */}
                    <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#D4A017]/40 to-transparent" />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-[#D4A017]/40 to-transparent" />

                    {/* Rotating Radar Sweep Beam */}
                    <div
                      className="absolute inset-0 rounded-full animate-spin pointer-events-none"
                      style={{
                        animationDuration: "2.8s",
                        background:
                          "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(212,160,23,0.05) 320deg, rgba(212,160,23,0.4) 360deg)",
                      }}
                    />

                    {/* Center HUD Core with percentage readout */}
                    <div className="relative z-10 w-24 h-24 rounded-full bg-[#0E121B] border-2 border-[#D4A017] flex flex-col items-center justify-center shadow-[0_0_35px_rgba(212,160,23,0.4)]">
                      <Radio className="w-5 h-5 text-[#D4A017] animate-pulse" />
                      <span className="font-mono font-black text-lg text-white mt-0.5">
                        {scanProgress}%
                      </span>
                      <span className="text-[7.5px] font-mono text-[#D4A017] tracking-widest uppercase font-bold">
                        AUDITING
                      </span>
                    </div>

                    {/* Dynamic radar blips */}
                    <div className="absolute top-12 right-16 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#10B981] animate-ping" />
                    <div className="absolute bottom-14 left-14 w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_10px_#F43F5E] animate-pulse" />
                    <div className="absolute top-24 left-12 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_#F59E0B] animate-ping" />
                  </div>

                  {/* Terminal Status Readout */}
                  <div className="w-full max-w-md font-mono mt-2 z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4A017]/10 border border-[#D4A017]/30 text-[#D4A017] text-[10px] font-bold tracking-widest uppercase mb-1.5">
                      <Terminal className="w-3 h-3" />
                      RADAR HUD: INSTITUTIONAL VIP AUDITOR
                    </div>
                    <h3 className="text-xs font-bold text-white tracking-wider">
                      SEDANG MENGESAHKAN REKOD PANGKALAN DATA BROKER
                    </h3>
                    <p className="text-[11px] text-amber-300 font-mono tracking-wide mt-1 truncate px-4 animate-pulse">
                      {currentScanningName || "Memulakan audit..."}
                    </p>

                    {/* Glowing Progress Bar */}
                    <div className="w-full bg-[#0E121B] h-2 rounded-full mt-3 overflow-hidden border border-zinc-800 p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 via-[#D4A017] to-yellow-300 rounded-full transition-all duration-150 shadow-[0_0_14px_rgba(212,160,23,0.8)]"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-zinc-500 mt-2">
                      <span className="text-zinc-400">
                        IMBAS:{" "}
                        <strong className="text-white">
                          {scanStatsLive.scanned}
                        </strong>{" "}
                        / {traders.length}
                      </span>
                      <span className="text-emerald-400">
                        SELAMAT: {scanStatsLive.safe}
                      </span>
                      <span className="text-rose-400">
                        KICK: {scanStatsLive.kick}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* AUDITED DATA TABLE */}
              {hasAuditedData && (
                <>
                  <div className="overflow-x-auto lg:overflow-x-hidden overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-zinc-800">
                    <table className="w-full text-left font-mono text-[10.5px] leading-tight">
                      <thead className="sticky top-0 z-10 bg-[#0E121B] text-zinc-400 text-[9px] xl:text-[9.5px] font-bold uppercase tracking-wider border-b border-[#212738]">
                        <tr>
                          <th className="py-2.5 px-2 text-center w-[115px]">
                            Keputusan
                          </th>
                          <th className="py-2.5 px-2 max-w-[130px] xl:max-w-[150px]">
                            Trader
                          </th>
                          <th className="py-2.5 px-1.5 max-w-[95px]">
                            Contact
                          </th>
                          <th className="py-2.5 px-2 max-w-[120px]">
                            TradingView ID
                          </th>
                          <th className="py-2.5 px-1.5 max-w-[85px]">
                            Valetax ID
                          </th>
                          <th className="py-2.5 px-2 max-w-[120px] xl:max-w-[140px]">
                            Partner Email
                          </th>
                          <th className="py-2.5 px-2 text-right w-[75px]">
                            Balance
                          </th>
                          <th className="py-2.5 px-1.5 text-center w-[85px]">
                            Status Asal
                          </th>
                          <th className="py-2.5 px-1.5 text-center w-[90px]">
                            Status Audit
                          </th>
                          <th className="py-2.5 px-2 max-w-[110px]">Catatan</th>
                          <th className="py-2.5 px-2 text-center w-[95px]">
                            Tindakan
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {paginatedRows.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="py-14 text-center">
                              <p className="text-zinc-400 font-semibold text-xs">
                                Tiada rekod dijumpai
                              </p>
                            </td>
                          </tr>
                        ) : (
                          paginatedRows.map((row) => {
                            const isRed = row.kick_decision === "RED";
                            const isYellow = row.kick_decision === "YELLOW";
                            const isAlready =
                              row.kick_decision === "ALREADY_KICKED";
                            const isSafe = row.kick_decision === "SAFE";

                            const auditStatusUpper = (
                              row.status_after || ""
                            ).toUpperCase();
                            const isAuditMC = auditStatusUpper === "MC";
                            const isAuditLow = auditStatusUpper.includes("LOW");
                            const isAuditActive =
                              auditStatusUpper === "ACTIVE" ||
                              auditStatusUpper.includes("VIP");
                            const isAuditNotValid =
                              auditStatusUpper.includes("NOT VALID");

                            return (
                              <tr
                                key={row.id}
                                className={`transition-colors border-l-2 ${
                                  isRed
                                    ? "bg-rose-950/15 hover:bg-rose-950/30 border-l-rose-500"
                                    : isYellow
                                      ? "bg-amber-950/15 hover:bg-amber-950/30 border-l-amber-500"
                                      : isAlready
                                        ? "bg-zinc-900/10 hover:bg-zinc-900/30 border-l-zinc-600 opacity-60"
                                        : "hover:bg-zinc-800/20 border-l-emerald-500"
                                }`}
                              >
                                <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                  {isRed && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30 text-[9px]">
                                      <UserX className="w-2.5 h-2.5" /> KICK
                                      MERAH
                                    </span>
                                  )}
                                  {isYellow && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 text-[9px]">
                                      <AlertTriangle className="w-2.5 h-2.5" />{" "}
                                      DEMO KICK
                                    </span>
                                  )}
                                  {isAlready && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-bold border border-zinc-700 text-[8.5px]">
                                      <CheckCircle2 className="w-2.5 h-2.5" />{" "}
                                      SUDAH DIKICK
                                    </span>
                                  )}
                                  {isSafe && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 text-[9px]">
                                      <ShieldCheck className="w-2.5 h-2.5" />{" "}
                                      SELAMAT
                                    </span>
                                  )}
                                </td>

                                <td
                                  className="py-1.5 px-2 font-semibold text-zinc-200 truncate max-w-[130px] xl:max-w-[150px]"
                                  title={row.trader_name}
                                >
                                  {row.trader_name || "—"}
                                </td>

                                <td
                                  className="py-1.5 px-1.5 text-zinc-400 truncate max-w-[95px]"
                                  title={row.contact_number}
                                >
                                  {row.contact_number || "—"}
                                </td>

                                <td className="py-1.5 px-2 max-w-[120px]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopySingle(
                                        row.trading_view_username,
                                        `tv-${row.id}`,
                                      )
                                    }
                                    title="Klik untuk salin TradingView ID"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#16130B] border border-[#D4A017]/30 text-[#D4A017] font-bold hover:bg-[#D4A017] hover:text-black transition-colors cursor-pointer truncate max-w-full"
                                  >
                                    <span className="truncate">
                                      {row.trading_view_username || "—"}
                                    </span>
                                    {copiedField === `tv-${row.id}` ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                    ) : (
                                      <Copy className="w-2 h-2 opacity-50 shrink-0" />
                                    )}
                                  </button>
                                </td>

                                <td className="py-1.5 px-1.5 text-zinc-300 truncate max-w-[85px]">
                                  <div className="flex items-center gap-1">
                                    <span>{row.valetax_id || "—"}</span>
                                    {row.isLiveBrokerSynced && (
                                      <span
                                        className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
                                        title="Data langsung dari broker (Live API)"
                                      />
                                    )}
                                  </div>
                                </td>

                                <td
                                  className="py-1.5 px-2 text-zinc-500 truncate max-w-[120px] xl:max-w-[140px]"
                                  title={row.direct_partner_email}
                                >
                                  {row.direct_partner_email || "—"}
                                </td>

                                <td className="py-1.5 px-2 text-right font-bold text-white whitespace-nowrap">
                                  ${row.balance}
                                </td>

                                {/* 1. STATUS ASAL: STRICTLY REFLECTS DATABASE VALUE */}
                                <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-900 text-zinc-400 border border-zinc-800">
                                    {row.status_before || "—"}
                                  </span>
                                </td>

                                {/* 1. STATUS AUDIT: LIVE EVALUATION (UPGRADED FROM NOT VALID IF BALANCE > 0) */}
                                <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                      isAuditMC
                                        ? "bg-rose-950/80 text-rose-300 border-rose-500/60"
                                        : isAuditLow
                                          ? "bg-amber-950/80 text-amber-300 border-amber-500/60"
                                          : isAuditActive
                                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/60"
                                            : isAuditNotValid
                                              ? "bg-zinc-900 text-zinc-400 border-zinc-700"
                                              : "bg-zinc-800 text-zinc-300 border-zinc-700"
                                    }`}
                                  >
                                    {row.status_after || "—"}
                                  </span>
                                </td>

                                {/* CATATAN (PARKING MODAL ONLY IF BALANCE DID NOT MOVE) */}
                                <td
                                  className="py-1.5 px-2 truncate max-w-[110px]"
                                  title={row.remark}
                                >
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                      row.remark === "Parking Modal"
                                        ? "bg-purple-950/60 text-purple-300 border border-purple-500/30"
                                        : row.remark.includes("Pulih")
                                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                                          : row.remark.includes(
                                                "Not Valid Lama",
                                              )
                                            ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                            : row.remark.includes("Live Broker")
                                              ? "bg-amber-950/60 text-amber-300 border border-amber-500/30 font-bold"
                                              : "text-zinc-500"
                                    }`}
                                  >
                                    {row.remark || "—"}
                                  </span>
                                </td>

                                <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                  {row.isLiveBrokerSynced ? (
                                    row.syncedToDb ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-500/30 text-[8.5px]">
                                        <Check className="w-2.5 h-2.5" />{" "}
                                        Disimpan
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={
                                          syncingValetaxId ===
                                          String(row.valetax_id)
                                        }
                                        onClick={() =>
                                          handleSyncRowToDb(
                                            row.valetax_id,
                                            row.balance,
                                            row.status_after,
                                          )
                                        }
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D4A017]/20 border border-[#D4A017]/50 text-[#D4A017] hover:bg-[#D4A017] hover:text-black font-bold text-[8.5px] transition-all cursor-pointer disabled:opacity-50"
                                        title="Simpan baki live ini ke pangkalan data Supabase"
                                      >
                                        {syncingValetaxId ===
                                        String(row.valetax_id) ? (
                                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                        ) : (
                                          <Save className="w-2.5 h-2.5" />
                                        )}
                                        Sync DB
                                      </button>
                                    )
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setManualValetaxId(
                                          String(row.valetax_id || ""),
                                        );
                                        setManualError(null);
                                        setManualCheckResult(null);
                                        setIsManualModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                                      title="Semak baki langsung dari broker API"
                                    >
                                      <Zap className="w-2.5 h-2.5 text-amber-400" />{" "}
                                      Semak
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION */}
                  <div className="px-3.5 py-2 bg-[#0E121B] border-t border-[#212738] flex flex-wrap items-center justify-between text-[10.5px] font-mono text-zinc-400 gap-2">
                    <div>
                      Halaman{" "}
                      <strong className="text-white">{currentPage}</strong>{" "}
                      daripada{" "}
                      <strong className="text-zinc-300">{totalPages}</strong>{" "}
                      (Jumlah:{" "}
                      <strong className="text-[#D4A017]">
                        {filteredRows.length}
                      </strong>{" "}
                      rekod)
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() =>
                          setCurrentPage((p) => Math.max(p - 1, 1))
                        }
                        className="p-1 px-2.5 rounded bg-zinc-900 border border-zinc-800 hover:border-[#D4A017] text-zinc-300 hover:text-white disabled:opacity-30 flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                      </button>

                      <span className="px-2 text-zinc-500 font-bold">
                        {currentPage} / {totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(p + 1, totalPages))
                        }
                        className="p-1 px-2.5 rounded bg-zinc-900 border border-zinc-800 hover:border-[#D4A017] text-zinc-300 hover:text-white disabled:opacity-30 flex items-center gap-1 cursor-pointer"
                      >
                        Seterusnya <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 4. TAB 2: HISTORY TIMELINE (Asia/Kuala_Lumpur GMT+8 & Blob CSV Export) */}
        {activeTab === "HISTORY" && (
          <div className="flex-1 p-5 md:p-6 overflow-auto font-mono flex flex-col bg-[#07090E]">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-white text-sm font-bold tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#D4A017]" />
                  REKOD SNAPSHOT SEJARAH AUDIT SETIAP 2 MINGGU
                </h2>
                <p className="text-zinc-500 text-xs mt-0.5 font-mono">
                  Arkib snapshot audit tersimpan dalam Supabase & storan tempatan
                  (Masa diselaraskan ke Asia/Kuala_Lumpur GMT+8).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchSupabaseHistory}
                  className="px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Segerakkan Awan
                </button>
                {historyList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllHistory}
                    className="px-3 py-1.5 rounded-xl border border-rose-900/40 bg-rose-950/20 text-rose-400 hover:bg-rose-900 hover:text-white text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Padam Semua
                  </button>
                )}
              </div>
            </div>

            {historyList.length === 0 ? (
              <div className="flex-1 w-full rounded-2xl border border-dashed border-zinc-800/80 bg-[#0A0D14]/50 flex flex-col items-center justify-center p-8 text-center min-h-[340px]">
                <Database className="w-8 h-8 text-zinc-500 mb-2" />
                <h3 className="text-zinc-200 text-sm font-bold">
                  Tiada Arkib Sejarah
                </h3>
                <p className="text-zinc-500 text-xs mt-1">
                  Tekan butang &apos;Save Data&apos; pada Tab Audit bila anda
                  selesai membuat audit untuk menyimpan snapshot ke Supabase.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {historyList.map((hist) => {
                  const gmt8Time = formatGMT8(hist.audit_date);
                  return (
                    <div
                      key={hist.id}
                      className="p-4 rounded-xl bg-gradient-to-b from-[#0E121B] to-[#0A0D14] border border-[#212738] hover:border-[#D4A017]/40 flex flex-col justify-between transition-all shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs pb-2.5 border-b border-zinc-800/60">
                          <span className="flex items-center gap-1.5 text-[#D4A017] font-bold">
                            <Calendar className="w-3.5 h-3.5" />
                            {gmt8Time.date}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                              <Clock className="w-3 h-3 text-amber-400" />
                              {gmt8Time.time}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(hist.id)}
                              title="Padam snapshot ini"
                              className="text-zinc-600 hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                          <div className="p-2 rounded-xl bg-black/50 border border-zinc-850">
                            <span className="text-[9px] text-zinc-500 block uppercase font-bold">
                              Imbas
                            </span>
                            <strong className="text-white text-sm font-black">
                              {hist.total_scanned}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
                            <span className="text-[9px] text-emerald-400 block uppercase font-bold">
                              Selamat
                            </span>
                            <strong className="text-emerald-400 text-sm font-black">
                              {hist.total_safe}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-rose-950/20 border border-rose-900/40">
                            <span className="text-[9px] text-rose-400 block uppercase font-bold">
                              Ditarik
                            </span>
                            <strong className="text-rose-400 text-sm font-black">
                              {hist.total_kicked}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* 4. EXPORT / BUKA SHEET BUTTON VIA BLOB */}
                      <div className="mt-4 pt-3 border-t border-zinc-850 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadSheet(hist)}
                          className="flex-1 py-2 bg-[#141F1A] border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          Export / Buka Sheet (CSV)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. MANUAL VALETAX CHECK MODAL */}
        {isManualModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-lg bg-[#0F141F] border border-[#D4A017]/50 rounded-2xl p-6 shadow-[0_0_60px_rgba(212,175,55,0.25)] relative font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#D4A017]/15 border border-[#D4A017]/40 flex items-center justify-center text-[#D4A017]">
                    <Crosshair className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider">
                      Pemeriksaan Manual Valetax ID
                    </h3>
                    <p className="text-[10px] text-zinc-500">
                      Semakan terus ke live API broker (/api/manual-check)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualModalOpen(false);
                    setManualError(null);
                  }}
                  className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteManualCheck} className="space-y-4">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1.5">
                    Masukkan Valetax Login ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      autoFocus
                      value={manualValetaxId}
                      onChange={(e) => {
                        setManualValetaxId(e.target.value);
                        if (manualError) setManualError(null);
                      }}
                      placeholder="Valetax ID (Trading Number)"
                      className="flex-1 bg-[#080B10] border border-zinc-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[#D4A017]"
                    />
                    <button
                      type="submit"
                      disabled={isManualChecking || !manualValetaxId.trim()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#E5B226] text-black font-black text-xs flex items-center gap-1.5 transition-all shadow-md hover:brightness-110 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isManualChecking ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                          Menyemak...
                        </>
                      ) : (
                        <>
                          <Search className="w-3.5 h-3.5" /> Check & Validasi
                        </>
                      )}
                    </button>
                  </div>

                  {manualError && (
                    <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="font-semibold">{manualError}</span>
                    </div>
                  )}
                </div>
              </form>

              {manualCheckResult && (
                <div className="mt-5 pt-4 border-t border-zinc-800 space-y-4">
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      manualCheckResult.kickDecision === "RED"
                        ? "bg-rose-950/40 border-rose-800 text-rose-300"
                        : manualCheckResult.kickDecision === "YELLOW"
                          ? "bg-amber-950/40 border-amber-800 text-amber-300"
                          : "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {manualCheckResult.kickDecision === "RED" && (
                        <>
                          <UserX className="w-4 h-4 text-rose-400" />
                          <span>
                            KEPUTUSAN: KICK MERAH ({manualCheckResult.status})
                          </span>
                        </>
                      )}
                      {manualCheckResult.kickDecision === "YELLOW" && (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>KEPUTUSAN: DEMO KICK (Akaun Demo)</span>
                        </>
                      )}
                      {manualCheckResult.kickDecision === "SAFE" && (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>
                            {manualCheckResult.multiAccountNotice
                              ? `KEPUTUSAN: ${manualCheckResult.multiAccountNotice}`
                              : `KEPUTUSAN: SELAMAT (${manualCheckResult.status})`}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-zinc-300 font-bold">
                      ⚡ LIVE BROKER API
                    </span>
                  </div>

                  {manualCheckResult.multiAccountNotice && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-emerald-200">
                          Perlindungan Multi-Akaun Diaktifkan
                        </div>
                        <div className="text-[11px] text-emerald-400/90 mt-0.5">
                          Akaun ini berstatus <strong className="text-white">{manualCheckResult.status}</strong>, tetapi trader memiliki sekurang-kurangnya satu akaun aktif lain di bawah ID TradingView{" "}
                          <strong className="text-amber-300 font-mono">
                            {manualCheckResult.tradingViewUsername}
                          </strong>
                          . Keputusan keseluruhan adalah <strong>SELAMAT</strong>.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div className="p-3 rounded-xl bg-[#080B10] border border-zinc-800">
                      <span className="text-[9.5px] text-zinc-500 uppercase block font-semibold">
                        Baki Sebenar (USD)
                      </span>
                      <div className="text-xl font-black text-white mt-0.5 flex items-baseline gap-1">
                        <span>${manualCheckResult.balance.toFixed(2)}</span>
                        <span className="text-[10px] text-amber-400 font-bold">
                          USD
                        </span>
                      </div>
                      {(manualCheckResult.currency === "USC" ||
                        manualCheckResult.currency === "IDR" ||
                        manualCheckResult.accountType
                          .toLowerCase()
                          .includes("cent")) && (
                        <p className="text-[9px] text-zinc-400 mt-1">
                          Ditukar dari {manualCheckResult.rawBalance}{" "}
                          {manualCheckResult.currency}
                        </p>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-[#080B10] border border-zinc-800">
                      <span className="text-[9.5px] text-zinc-500 uppercase block font-semibold">
                        Status Asal (DB)
                      </span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 border border-zinc-700 text-zinc-300">
                          {manualCheckResult.statusBefore}
                        </span>
                        {manualCheckResult.isLocalMatch ? (
                          <span className="text-emerald-400 text-[10px] font-bold">
                            ✓ Di Supabase
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[10px]">
                            ⚠️ Broker Sahaja
                          </span>
                        )}
                      </div>
                      <p className="text-[9.5px] text-zinc-400 mt-1 truncate">
                        Akaun:{" "}
                        <strong className="text-zinc-200">
                          {manualCheckResult.accountType}
                        </strong>{" "}
                        ({manualCheckResult.currency})
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#080B10] border border-zinc-800">
                      <span className="text-[9px] text-zinc-500 uppercase block font-semibold">
                        Nama Trader
                      </span>
                      <p
                        className="text-white font-bold truncate mt-0.5"
                        title={manualCheckResult.traderName}
                      >
                        {manualCheckResult.traderName}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#080B10] border border-zinc-800">
                      <span className="text-[9px] text-zinc-500 uppercase block font-semibold">
                        TradingView ID
                      </span>
                      <p
                        className="text-amber-400 font-bold truncate mt-0.5"
                        title={manualCheckResult.tradingViewUsername}
                      >
                        {manualCheckResult.tradingViewUsername}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setManualCheckResult(null);
                        setManualValetaxId("");
                      }}
                      className="px-3 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors cursor-pointer"
                    >
                      Semak ID Lain
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsManualModalOpen(false)}
                        className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Lihat Dalam Jadual
                      </button>

                      {/* Sync Row to DB Button */}
                      <button
                        type="button"
                        disabled={
                          syncingValetaxId === manualCheckResult.valetaxId ||
                          manualCheckResult.isSynced
                        }
                        onClick={() =>
                          handleSyncRowToDb(
                            manualCheckResult.valetaxId,
                            manualCheckResult.balance,
                            manualCheckResult.status,
                            manualCheckResult.equity,
                          )
                        }
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          manualCheckResult.isSynced
                            ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 cursor-default"
                            : "bg-[#D4A017] hover:bg-[#E5B226] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                        }`}
                      >
                        {syncingValetaxId === manualCheckResult.valetaxId ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />{" "}
                            Menyimpan...
                          </>
                        ) : manualCheckResult.isSynced ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Tersimpan di
                            Supabase
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" /> Sync Row to DB
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FEEDBACK TOAST */}
        {syncFeedbackToast && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-zinc-900 border border-[#D4A017]/60 text-white font-mono text-xs shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedbackToast}</span>
          </div>
        )}
      </div>
    </div>
  );
};
export default AuditStudioModal;
