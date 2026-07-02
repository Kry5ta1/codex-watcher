import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampTransparency, expiryInfo, relativeChecked } from "../lib/widget.js";

describe("widget expiry copy", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const dayMs = 24 * 60 * 60 * 1000;

  it("only marks tickets under 15 days as use soon", () => {
    const under15 = expiryInfo(new Date(now.getTime() + 14 * dayMs), now);
    const exactly15 = expiryInfo(new Date(now.getTime() + 15 * dayMs), now);

    assert.equal(under15.useSoon, true);
    assert.match(under15.text, /还有14天到期/);
    assert.equal(exactly15.useSoon, false);
    assert.match(exactly15.text, /还有15天到期/);
  });

  it("formats the latest checked copy in minutes", () => {
    assert.equal(
      relativeChecked(new Date(now.getTime() - 7 * 60_000), now),
      "7min之前"
    );
    assert.equal(relativeChecked(null, now), "尚未同步");
  });

  it("clamps acrylic transparency settings", () => {
    assert.equal(clampTransparency(-1), 0);
    assert.equal(clampTransparency(120), 100);
    assert.equal(clampTransparency("24"), 24);
    assert.equal(clampTransparency("bad"), 18);
  });
});
