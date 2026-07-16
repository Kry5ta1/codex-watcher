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
      plan_type: "plus",
      rate_limit: {
        primary_window: {
          limit_window_seconds: 7 * 86400,
          reset_after_seconds: 2 * 86400,
          used_percent: 35
        }
      }
    });

    assert.equal(usage.planLabel, "Plus");
    assert.deepEqual(
      usage.windows.map(({ id, kind, title }) => ({ id, kind, title })),
      [{ id: "weekly", kind: "weekly", title: "每周额度" }]
    );
  });

  it("ignores the retired short window even when the upstream still returns it", () => {
    const usage = decodeUsageResponse({
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
