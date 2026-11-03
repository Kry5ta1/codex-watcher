import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeResetCreditsResponse,
  decodeUsageResponse,
  makeNudge,
  makeUrgency
} from "../lib/codex.js";

function window(kind, remaining, resetAfterSeconds) {
  return {
    id: kind,
    kind,
    remainingPercent: remaining,
    resetAfterSeconds,
    usedPercent: 100 - remaining
  };
}

describe("reset urgency", () => {
  const now = new Date(1800000000000);

  it("keeps exact expiry boundaries", () => {
    assert.equal(makeUrgency(new Date(now.getTime() + 7 * 86400_000 + 1), now).level, "normal");
    assert.equal(makeUrgency(new Date(now.getTime() + 7 * 86400_000), now).level, "approaching");
    assert.equal(makeUrgency(new Date(now.getTime() + 3 * 86400_000), now).level, "soon");
    assert.equal(makeUrgency(new Date(now.getTime() + 86400_000), now).level, "urgent");
    assert.equal(makeUrgency(now, now).level, "expired");
  });
});

describe("usage window decoding", () => {
  it("recognizes a weekly window returned in primary_window", () => {
    const usage = decodeUsageResponse({
      plan_type: "pro",
      rate_limit: {
        primary_window: {
          limit_window_seconds: 7 * 86400,
          reset_after_seconds: 2 * 86400,
          used_percent: 35
        }
      }
    });

    assert.equal(usage.planLabel, "Pro");
    assert.deepEqual(
      usage.windows.map(({ id, kind, title }) => ({ id, kind, title })),
      [{ id: "weekly", kind: "weekly", title: "每周额度" }]
    );
  });

  it("selects only the weekly window for Pro even when a short window is returned", () => {
    const usage = decodeUsageResponse({
      planType: "pro",
      rateLimit: {
        primaryWindow: { limitWindowSeconds: 7 * 86400, usedPercent: 20 },
        secondaryWindow: { limitWindowSeconds: 5 * 3600, usedPercent: 40 }
      }
    });

    assert.deepEqual(
      usage.windows.map((item) => item.kind),
      ["weekly"]
    );
  });
});

describe("usage nudge", () => {
  it("tells the user to spend only when weekly room is thin and resets exist", () => {
    const nudge = makeNudge([window("weekly", 10, 5 * 86400)], 2);

    assert.equal(nudge.tier, "spend");
    assert.equal(nudge.title, "可以推进任务了");
  });

  it("warns when weekly quota is low and there are no resets", () => {
    const nudge = makeNudge([window("weekly", 12, 4 * 86400)], 0);

    assert.equal(nudge.tier, "noResets");
    assert.equal(nudge.title, "没有备用重置，先控节奏");
    assert.match(nudge.message, /减少大批量和并发请求/);
  });

  it("holds resets when weekly refresh is close", () => {
    const nudge = makeNudge([window("weekly", 12, 8 * 3600)], 1);

    assert.equal(nudge.tier, "hold");
    assert.equal(nudge.title, "快到每周刷新，先撑一撑");
  });
});

describe("credit decoding", () => {
  it("drops malformed credit rows and derives the fallback count", () => {
    const response = decodeResetCreditsResponse({
      credits: [
        { id: 123, status: "AVAILABLE", expires_at: "2026-07-11T21:13:00Z" },
        { status: "available", expires_at: "2026-07-12T21:13:00Z" },
        { id: "credit-2", status: "redeemed" }
      ]
    });

    assert.deepEqual(response.credits.map((credit) => credit.id), [
      "123",
      "credit-2"
    ]);
    assert.equal(response.availableCount, 1);
  });
});

describe("subscription-aware quota selection", () => {
  const short = { limit_window_seconds: 18000, used_percent: 40, reset_after_seconds: 3600 };
  const weekly = { limit_window_seconds: 604800, used_percent: 80, reset_after_seconds: 86400 };
  const usage = (plan_type, primary_window = short, secondary_window = weekly) =>
    decodeUsageResponse({ plan_type, rate_limit: { primary_window, secondary_window } });

  it("shows only Plus 5H data and preserves its countdown", () => {
    const result = usage(" PLUS ");
    assert.equal(result.planLabel, "Plus");
    assert.equal(result.warning, undefined);
    assert.deepEqual(result.windows.map(({ kind, title, remainingPercent, resetIn }) =>
      ({ kind, title, remainingPercent, resetIn })),
    [{ kind: "short", title: "5 小时额度", remainingPercent: 60, resetIn: "1 小时" }]);
  });

  it("recognizes all supported higher-tier identifiers", () => {
    for (const plan of ["pro", "prolite", "promax", "team", "business", "self_serve_business_prolite",
      "self_serve_business_usage_based", "enterprise", "ent26", "hc", "enterprise_cbp_automation",
      "enterprise_cbp_usage_based", "edu", "education", "edu_plus", "edu_pro"]) {
      assert.deepEqual(usage(plan).windows.map(w => w.kind), ["weekly"], plan);
    }
  });

  it("uses duration rather than slot position for either plan", () => {
    assert.equal(usage("plus", weekly, short).windows[0].kind, "short");
    assert.equal(usage("pro", weekly, short).windows[0].kind, "weekly");
  });

  it("does not treat unknown, Free or Go plans as higher subscriptions", () => {
    for (const plan of [undefined, null, "", " ", "free", "go", "future_plan", {}, 42]) {
      assert.deepEqual(usage(plan).windows, []);
      assert.match(usage(plan).warning, /订阅类型/);
    }
  });

  it("does not substitute another window when the required window is absent", () => {
    assert.deepEqual(usage("plus", weekly, null).windows, []);
    assert.match(usage("plus", weekly, null).warning, /5 小时/);
    assert.deepEqual(usage("pro", short, null).windows, []);
    assert.match(usage("pro", short, null).warning, /每周/);
  });

  it("does not guess missing or nearby durations as 5H or weekly", () => {
    for (const seconds of [undefined, 14400, 21600, 518400, 864000, -1]) {
      const other = { limit_window_seconds: seconds, used_percent: 20 };
      assert.deepEqual(usage("plus", other, null).windows, []);
      assert.deepEqual(usage("pro", other, null).windows, []);
    }
  });

  it("keeps absent percentages unknown and clamps valid percentages", () => {
    assert.equal(usage("plus", { ...short, used_percent: undefined }).windows[0].remainingPercent, undefined);
    assert.equal(usage("plus", { ...short, used_percent: "invalid" }).windows[0].remainingPercent, undefined);
    assert.equal(usage("plus", { ...short, used_percent: 150 }).windows[0].remainingPercent, 0);
    assert.equal(usage("plus", { ...short, used_percent: -5 }).windows[0].remainingPercent, 100);
  });

  it("supports camelCase and numeric-string window fields", () => {
    const result = decodeUsageResponse({ planType: "Plus", rateLimit: {
      secondaryWindow: { limitWindowSeconds: "18000", usedPercent: "25", resetAfterSeconds: "120" }
    } });
    assert.equal(result.windows[0].remainingPercent, 75);
    assert.equal(result.windows[0].resetIn, "2 分钟");
  });

  it("re-evaluates the plan on every response without retaining prior quota", () => {
    assert.equal(usage("plus").windows[0].remainingPercent, 60);
    assert.equal(usage("pro").windows[0].remainingPercent, 20);
    assert.deepEqual(usage(undefined).windows, []);
    assert.equal(usage("plus").windows[0].kind, "short");
  });

  it("does not apply weekly reset advice to Plus", () => {
    for (const remaining of [0, 15, 25, 26, 90]) {
      const nudge = makeNudge([window("short", remaining, 3600)], 2, [{ level: "urgent" }]);
      assert.match(nudge.title, /5 小时/);
      assert.doesNotMatch(nudge.message, /每周|周额度|使用.*重置/);
    }
    assert.equal(makeNudge([window("short", undefined, 3600)], 2, [{ level: "urgent" }]).tier, "unavailable");
    assert.equal(makeNudge([], 2, [{ level: "urgent" }]).tier, "unavailable");
  });
});
