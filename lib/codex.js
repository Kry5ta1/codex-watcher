import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
const CREDITS_ENDPOINT =
  "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";

export async function loadStatus() {
  const lastChecked = new Date().toISOString();
  let auth;

  try {
    auth = await loadAuth();
  } catch (error) {
    return emptyStatus(lastChecked, [error.message]);
  }

  const [creditsResult, usageResult] = await Promise.allSettled([
    fetchCodexJson(CREDITS_ENDPOINT, auth),
    fetchCodexJson(USAGE_ENDPOINT, auth)
  ]);

  const errors = [];
  let credits = [];
  let availableCount = 0;
  let windows = [];
  let planLabel = "Codex";

  if (creditsResult.status === "fulfilled") {
    const decoded = decodeResetCreditsResponse(creditsResult.value);
    credits = decoded.credits;
    availableCount = decoded.availableCount;
  } else {
    errors.push(`无法加载重置额度。${creditsResult.reason.message}`);
  }

  if (usageResult.status === "fulfilled") {
    const usage = decodeUsageResponse(usageResult.value);
    windows = usage.windows;
    planLabel = usage.planLabel;

    if (
      creditsResult.status === "rejected" &&
      credits.length === 0 &&
      usage.fallbackResetCount !== undefined
    ) {
      availableCount = usage.fallbackResetCount;
    }
  } else {
    errors.push(`无法加载使用额度。${usageResult.reason.message}`);
  }

  return {
    availableCount,
    credits,
    errors,
    lastChecked,
    nudge: makeNudge(
      windows,
      availableCount,
      credits.filter((credit) => credit.isAvailable).map((credit) => credit.urgency)
    ),
    planLabel,
    windows
  };
}

export function decodeUsageResponse(raw) {
  const rateLimit = pick(raw, "rate_limit", "rateLimit") ?? {};
  const primary = displayWindow(
    pick(rateLimit, "primary_window", "primaryWindow"),
    "primary",
    pick(rateLimit, "limit_reached", "limitReached") === true
  );
  const secondary = displayWindow(
    pick(rateLimit, "secondary_window", "secondaryWindow"),
    "secondary",
    pick(rateLimit, "limit_reached", "limitReached") === true
  );
  const resetCredits = pick(
    raw,
    "rate_limit_reset_credits",
    "rateLimitResetCredits"
  );
  const planType = asString(pick(raw, "plan_type", "planType"));

  return {
    fallbackResetCount: asNumber(
      pick(resetCredits, "available_count", "availableCount")
    ),
    planLabel: planType ? titleize(planType) : "Codex",
    windows: [primary, secondary].filter(Boolean)
  };
}

export function decodeResetCreditsResponse(raw) {
  const credits = (Array.isArray(raw?.credits) ? raw.credits : [])
    .map(decodeCredit)
    .filter(Boolean)
    .sort(sortByExpiry);
  const availableCount =
    asNumber(pick(raw, "available_count", "availableCount")) ??
    credits.filter((credit) => credit.isAvailable).length;

  return { availableCount, credits };
}

export function makeNudge(windows, resetCount, resetUrgencies = []) {
  const hasUrgentReset = resetUrgencies.some((urgency) => urgency.level === "urgent");
  const hasSoonReset = resetUrgencies.some((urgency) => urgency.level === "soon");

  if (
    resetCount > 0 &&
    hasUrgentReset
  ) {
    return {
      tier: "expiringReset",
      title: "今天到期，优先处理",
      message:
        "有储备重置今天到期。如果今天有真实任务被额度卡住，优先使用快到期的这张；没有明确任务就不要为了消耗而使用。",
      detail: "今天到期"
    };
  }

  const weekly = windows.find(
    (window) =>
      window.kind === "weekly" && Number.isFinite(window.remainingPercent)
  );

  if (!weekly) {
    return {
      tier: "unavailable",
      title: "正在等待额度数据",
      message: "重置额度已加载，Codex 使用窗口还在更新中。",
      detail: "稍后再试"
    };
  }

  const weeklyRemaining = weekly.remainingPercent;
  const weeklyResetSeconds = weekly.resetAfterSeconds;
  const weeklyCritical = weeklyRemaining <= 15;
  const weeklyLow = weeklyRemaining <= 25;
  const weeklyPlenty = weeklyRemaining >= 60;
  const weeklyResetKnown = Number.isFinite(weeklyResetSeconds);
  const weeklyDays = weeklyResetKnown ? weeklyResetSeconds / 86400 : undefined;
  const weeklyResetVerySoon = weeklyResetKnown && weeklyDays <= 1;
  const weeklyResetFar = weeklyResetKnown && weeklyDays >= 3;

  if (resetCount === 0) {
    if (weeklyCritical) {
      return {
        tier: "noResets",
        title: "没有备用重置，先控节奏",
        message:
          "先保留额度给关键任务，减少大批量和并发请求，等窗口恢复后再跑非必要任务。",
        detail: "无储备重置"
      };
    }

    if (weeklyLow) {
      return {
        tier: "noResets",
        title: "没有备用重置，别把额度打满",
        message:
          "继续工作可以，但先避免一次性启动大任务，留一点余量给临时需求。",
        detail: "无储备重置"
      };
    }

    return {
      tier: "noResets",
      title: "没有备用重置",
      message:
        "当前额度还可正常使用；大批量任务开始前再检查一次。",
      detail: `周额度剩余 ${weeklyRemaining}%`
    };
  }

  if (weeklyCritical && weeklyResetVerySoon) {
    return {
      tier: "hold",
      title: "快到每周刷新，先撑一撑",
      message:
        "每周窗口很快会恢复。除非当前任务已经被额度卡住，否则先等周额度自然刷新。",
      detail: `距离每周重置 ${duration(weeklyResetSeconds)}`
    };
  }

  if (weeklyCritical && resetCount >= 2 && weeklyResetFar) {
    return {
      tier: "spend",
      title: "可以推进任务了",
      message:
        "每周额度偏紧且距离刷新还久。可以继续推进关键任务；如果遇到额度阻塞，使用储备重置是合理的。",
      detail: `周额度剩余 ${weeklyRemaining}%`
    };
  }

  if (weeklyCritical && resetCount >= 1) {
    return {
      tier: "useIfBlocked",
      title: "周额度告急，按阻塞程度使用",
      message:
        "先保关键任务，如果 Codex 已经影响真实工作，就使用 1 个储备重置；普通探索任务先暂停。",
      detail: `周额度剩余 ${weeklyRemaining}%`
    };
  }

  if (weeklyLow && resetCount >= 2 && weeklyResetFar) {
    return {
      tier: "useIfBlocked",
      title: "周额度偏紧，重置留给关键任务",
      message:
        "距离每周刷新还有一段时间。可以继续正常工作，但把储备重置留给会被额度卡住的关键任务。",
      detail: `周额度剩余 ${weeklyRemaining}%`
    };
  }

  if (weeklyResetSeconds === undefined) {
    return {
      tier: "steady",
      title: "重置时间不明确",
      message:
        "Codex 没有返回每周重置计时。继续工作可以，只有真实任务被卡住时再使用重置。",
      detail: `周额度剩余 ${weeklyRemaining}%`
    };
  }

  if (weeklyRemaining >= 35 && weeklyDays <= 3) {
    return {
      tier: "hold",
      title: "先保留重置",
      message:
        `每周额度将在 ${duration(weeklyResetSeconds)} 后刷新。先把储备重置留着。`,
      detail: `周额度剩余 ${weeklyRemaining}%`
    };
  }

  if (weeklyRemaining >= 25 && weeklyDays <= 2) {
    return {
      tier: "hold",
      title: "把重置留在手里",
      message:
        "距离每周刷新已经很近。当前还没紧张到必须使用重置。",
      detail: `还有 ${duration(weeklyResetSeconds)}`
    };
  }

  if (hasSoonReset && weeklyLow) {
    return {
      tier: "expiringReset",
      title: "有重置即将到期",
      message:
        "有储备重置 3 天内到期。如果任务被额度卡住，优先使用快到期的重置；否则继续保留。",
      detail: "3 天内到期"
    };
  }

  if (weeklyPlenty) {
    return {
      tier: "hold",
      title: "额度健康，先不动重置",
      message:
        "当前额度健康，继续正常工作，把储备重置留给后续高峰或紧急任务。",
      detail: `周额度剩余 ${weeklyRemaining}%`
    };
  }

  return {
    tier: "steady",
    title: "正常使用",
    message: "继续工作即可；开始大批量任务前再检查一次额度状态。",
    detail: `周额度剩余 ${weeklyRemaining}%`
  };
}

export function makeUrgency(expiresAt, now = new Date(), isAvailable = true) {
  if (!isAvailable) {
    return { level: "inactive", badge: "已使用", hint: null };
  }

  const date = parseDate(expiresAt);
  if (!date) {
    return { level: "unknown", badge: "可用", hint: "到期时间未知" };
  }

  const seconds = (date.getTime() - now.getTime()) / 1000;
  if (seconds <= 0) {
    return {
      level: "expired",
      badge: "已过期",
      hint: "这个重置额度已经过期"
    };
  }
  if (seconds <= 86400) {
    return {
      level: "urgent",
      badge: "今天到期",
      hint: "尽快使用，否则就让它过期"
    };
  }
  if (seconds <= 3 * 86400) {
    return {
      level: "soon",
      badge: "即将到期",
      hint: "建议留意这个重置额度"
    };
  }
  if (seconds <= 7 * 86400) {
    return {
      level: "approaching",
      badge: "本周到期",
      hint: "到期时间正在接近"
    };
  }
  return { level: "normal", badge: "可用", hint: null };
}

function emptyStatus(lastChecked, errors) {
  return {
    availableCount: 0,
    credits: [],
    errors,
    lastChecked,
    nudge: makeNudge([], 0),
    planLabel: "Codex",
    windows: []
  };
}

async function loadAuth() {
  const authPath = path.join(resolveCodexHome(), "auth.json");
  let raw;

  try {
    raw = await readFile(authPath, "utf8");
  } catch {
    throw new Error(
      `没有找到 Codex 登录文件：${authPath}。请先打开 Codex Desktop 并登录。`
    );
  }

  try {
    const json = JSON.parse(raw);
    const tokens = json.tokens ?? {};
    const accessToken = asString(
      pick(tokens, "access_token", "accessToken")
    );
    const accountId = asString(pick(tokens, "account_id", "accountId"));

    if (!accessToken) {
      throw new Error("缺少 access token");
    }

    return { accessToken, accountId };
  } catch {
    throw new Error(
      `无法读取 Codex 登录文件：${authPath}。请重新打开 Codex Desktop 并登录。`
    );
  }
}

function resolveCodexHome() {
  const configured = process.env.CODEX_HOME?.trim();
  if (!configured) {
    return path.join(os.homedir(), ".codex");
  }
  return configured.replace(/^~(?=$|[\\/])/, os.homedir());
}

async function fetchCodexJson(endpoint, auth) {
  const accountId = accountIdFromToken(auth.accessToken) ?? auth.accountId;
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${auth.accessToken}`,
    originator: "Codex Desktop",
    "OAI-Product-Sku": "CODEX"
  };

  if (accountId) {
    headers["ChatGPT-Account-Id"] = accountId;
  }

  const response = await fetch(endpoint, {
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new Error(
        retryAfter
          ? `Codex 限制了本次检查。请在 ${retryAfter} 秒后重试。`
          : "Codex 限制了本次检查。请稍后再试。"
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Codex 拒绝了已保存的登录信息。请重新打开 Codex Desktop 并登录。"
      );
    }
    throw new Error(`Codex 接口返回了 HTTP ${response.status}。`);
  }

  if (!text) {
    throw new Error("Codex 接口返回了空响应。");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(
      `Codex 接口返回了 ${contentType || "未知内容"}，不是 JSON。`
    );
  }

  return JSON.parse(text);
}

function accountIdFromToken(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return json["https://api.openai.com/auth"]?.chatgpt_account_id ?? null;
  } catch {
    return null;
  }
}

function displayWindow(raw, fallbackID, limitReached) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const usedPercent = clampPercent(asNumber(pick(raw, "used_percent", "usedPercent")));
  const limitWindowSeconds = asNumber(
    pick(raw, "limit_window_seconds", "limitWindowSeconds")
  );
  const resetAfterSeconds = asNumber(
    pick(raw, "reset_after_seconds", "resetAfterSeconds")
  );
  const seconds = limitWindowSeconds ?? 0;

  if (seconds >= 14400 && seconds <= 21600) {
    return null;
  }

  const kind =
    seconds >= 518400 && seconds <= 864000 ? "weekly" : "generic";

  return {
    id: kind === "weekly" ? "weekly" : fallbackID,
    kind,
    limitReached,
    limitWindowSeconds,
    remainingPercent:
      usedPercent === undefined ? undefined : clampPercent(100 - usedPercent),
    resetAfterSeconds,
    resetAt: resetAtToIso(pick(raw, "reset_at", "resetAt")),
    resetIn: duration(resetAfterSeconds),
    title: kind === "weekly" ? "每周额度" : windowTitle(seconds),
    usedPercent
  };
}

function decodeCredit(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = asString(raw.id);
  if (!id) {
    return null;
  }

  const status = asString(raw.status) ?? "unknown";
  const expiresAt = asString(pick(raw, "expires_at", "expiresAt"));
  const isAvailable = status.toLowerCase() === "available";

  return {
    description: asString(raw.description),
    expiresAt,
    grantedAt: asString(pick(raw, "granted_at", "grantedAt")),
    id,
    isAvailable,
    redeemedAt: asString(pick(raw, "redeemed_at", "redeemedAt")),
    redeemStartedAt: asString(
      pick(raw, "redeem_started_at", "redeemStartedAt")
    ),
    resetType: asString(pick(raw, "reset_type", "resetType")) ?? "unknown",
    status,
    title: translateCreditTitle(asString(raw.title)) ?? "Codex 重置额度",
    urgency: makeUrgency(expiresAt, new Date(), isAvailable)
  };
}

function sortByExpiry(left, right) {
  const leftTime = Date.parse(left.expiresAt);
  const rightTime = Date.parse(right.expiresAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime;
  }
  if (Number.isFinite(leftTime)) {
    return -1;
  }
  if (Number.isFinite(rightTime)) {
    return 1;
  }
  return left.id.localeCompare(right.id);
}

function pick(value, ...keys) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) {
      return value[key];
    }
  }
  return undefined;
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asString(value) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function clampPercent(value) {
  return value === undefined ? undefined : Math.max(0, Math.min(100, value));
}

function resetAtToIso(value) {
  const resetAt = asNumber(value);
  if (resetAt === undefined) {
    return null;
  }
  const seconds = resetAt > 10000000000 ? resetAt / 1000 : resetAt;
  return new Date(seconds * 1000).toISOString();
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function duration(seconds) {
  if (seconds === undefined) {
    return "-";
  }

  const clamped = Math.max(0, seconds);
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);

  if (days > 0) {
    return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
  }
  return `${Math.max(1, minutes)} 分钟`;
}

function windowTitle(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "使用额度";
  }
  if (seconds >= 86400) {
    return `${Math.max(1, Math.floor(seconds / 86400))} 天额度`;
  }
  return `${Math.max(1, Math.floor(seconds / 3600))} 小时额度`;
}

function translateCreditTitle(value) {
  if (!value) {
    return undefined;
  }
  if (
    value === "One free rate limit reset" ||
    value === "Codex reset credit"
  ) {
    return "Codex 重置额度";
  }
  return value;
}

function titleize(value) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
