import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeResetCreditsResponse,
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

describe("usage nudge", () => {
  it("waits for the 5h window when weekly room is healthy", () => {
    const nudge = makeNudge(
      [window("fiveHour", 8, 45 * 60), window("weekly", 45, 3 * 86400)],
      1
    );

    assert.equal(nudge.tier, "waitFiveHour");
    assert.equal(nudge.title, "先等 5 小时窗口恢复");
  });

  it("tells the user to spend only when weekly room is thin and resets exist", () => {
    const nudge = makeNudge([window("weekly", 10, 5 * 86400)], 2);

    assert.equal(nudge.tier, "spend");
    assert.equal(nudge.title, "可以推进任务了");
  });

  it("warns when both quota windows are low and there are no resets", () => {
    const nudge = makeNudge(
      [window("fiveHour", 8, 3 * 3600), window("weekly", 12, 4 * 86400)],
      0
    );

    assert.equal(nudge.tier, "noResets");
    assert.equal(nudge.title, "没有备用重置，先控节奏");
    assert.match(nudge.message, /减少大批量和并发请求/);
  });

  it("holds resets when weekly refresh is close", () => {
    const nudge = makeNudge(
      [window("fiveHour", 45, 2 * 3600), window("weekly", 12, 8 * 3600)],
      1
    );

    assert.equal(nudge.tier, "hold");
    assert.equal(nudge.title, "快到每周刷新，先撑一撑");
  });

  it("uses deadline guidance when the short window is low but weekly quota is healthy", () => {
    const nudge = makeNudge(
      [window("fiveHour", 18, 2 * 3600), window("weekly", 70, 5 * 86400)],
      1
    );

    assert.equal(nudge.tier, "deadline");
    assert.equal(nudge.title, "按截止时间决定");
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
