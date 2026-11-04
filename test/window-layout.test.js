import assert from "node:assert/strict";
import { describe, it } from "node:test";
import layout from "../desktop/window-layout.cjs";
const { normalizeContentSize, selectWorkArea, fitWindowLayout } = layout;
const primary = { id: 1, scaleFactor: 1.5, workArea: { x: 0, y: 0, width: 1280, height: 760 } };
const secondary = { id: 2, scaleFactor: 2, workArea: { x: -1920, y: -200, width: 1920, height: 1040 } };
const roomy = { x: 0, y: 0, width: 1920, height: 1200 };

describe("desktop content sizing", () => {
  it("starts at 440 CSS pixels and fits the display work area", () => {
    const result = fitWindowLayout(null, primary.workArea, null);
    assert.equal(result.layout.width, 440);
    assert.equal(result.bounds.width, 440);
    assert.equal(result.bounds.height, 760);
    assert.equal(result.layout.scale, 760 / 780);
  });
  it("grows to all measured content without shrinking the user's larger width", () => {
    const result = fitWindowLayout({ x: 40, y: 40, width: 520, height: 700 }, roomy, { width: 520, height: 980 });
    assert.deepEqual(result.bounds, { x: 40, y: 40, width: 520, height: 980 });
    assert.deepEqual(result.minimum, { width: 420, height: 980 });
    assert.equal(result.layout.scale, 1);
  });
  it("preserves extra window space when a theme or ticket list becomes shorter", () => {
    const result = fitWindowLayout({ x: 40, y: 40, width: 540, height: 1000 }, roomy, { width: 540, height: 600 });
    assert.equal(result.bounds.height, 1000);
    assert.equal(result.bounds.width, 540);
    assert.equal(result.minimum.height, 600);
  });
  it("enforces a 420 natural pixel floor", () => {
    const result = fitWindowLayout({ x: 0, y: 0, width: 380, height: 620 }, roomy, { width: 420, height: 800 });
    assert.equal(result.bounds.width, 420);
    assert.equal(result.minimum.width, 420);
    assert.equal(result.bounds.height, 800);
  });
  it("scales the entire layout only when content exceeds the work area", () => {
    const result = fitWindowLayout({ x: 0, y: 0, width: 440, height: 700 }, primary.workArea, { width: 440, height: 1000 });
    assert.equal(result.layout.scale, 0.76);
    assert.equal(result.minimum.height, 760);
    assert.equal(result.bounds.height, 760);
    assert.equal(result.minimum.width, Math.ceil(420 * 0.76));
  });
  it("fits narrow displays without relaying out below the natural width floor", () => {
    const area = { x: 0, y: 0, width: 320, height: 1000 };
    const result = fitWindowLayout(null, area, { width: 420, height: 800 });
    assert.equal(result.layout.width, 420);
    assert.equal(result.layout.scale, 320 / 420);
    assert.equal(result.bounds.width, 320);
    assert.ok(result.layout.height * result.layout.scale <= area.height);
  });
  it("keeps the complete window inside negative-coordinate secondary work areas", () => {
    const bounds = { x: -80, y: 650, width: 500, height: 900 };
    const result = fitWindowLayout(bounds, secondary.workArea, { width: 500, height: 900 });
    assert.ok(result.bounds.x >= -1920);
    assert.ok(result.bounds.x + result.bounds.width <= 0);
    assert.ok(result.bounds.y >= -200);
    assert.ok(result.bounds.y + result.bounds.height <= 840);
  });
  it("retains a saved secondary monitor and restores disconnected windows safely", () => {
    const bounds = { x: -1600, y: 50, width: 440, height: 800 };
    assert.deepEqual(selectWorkArea(bounds, [primary, secondary], primary.id), secondary.workArea);
    assert.deepEqual(selectWorkArea(bounds, [primary], primary.id), primary.workArea);
    const result = fitWindowLayout(bounds, primary.workArea, { width: 440, height: 800 });
    assert.equal(result.bounds.x, 0);
  });
  it("uses greatest overlap when dragging between monitors", () => {
    const bounds = { x: -100, y: 0, width: 440, height: 600 };
    assert.deepEqual(selectWorkArea(bounds, [primary, secondary], primary.id), primary.workArea);
  });
  it("does not multiply DIP dimensions by the monitor DPI scale", () => {
    const display = { ...primary, scaleFactor: 3 };
    const area = selectWorkArea(null, [display], display.id);
    assert.equal(area.width, 1280);
    assert.equal(fitWindowLayout(null, area, null).bounds.width, 440);
  });
  it("converges on repeated identical measurements instead of resize loops", () => {
    for (const height of [500, 780, 1000, 1555]) {
      const measured = { width: 440, height };
      const first = fitWindowLayout({ x: 200, y: 300, width: 440, height: 700 }, primary.workArea, measured);
      const again = fitWindowLayout(first.bounds, primary.workArea, measured);
      assert.deepEqual(again, first);
    }
  });
  it("returns to full scale on a larger monitor and expands to the content", () => {
    const small = fitWindowLayout({ x: 0, y: 0, width: 440, height: 700 }, primary.workArea, { width: 440, height: 950 });
    const large = fitWindowLayout(small.bounds, roomy, { width: 440, height: 950 });
    assert.equal(large.layout.scale, 1);
    assert.equal(large.bounds.height, 950);
  });
  it("rejects invalid or unbounded renderer payloads", () => {
    for (const value of [null, {}, { width: 0, height: 400 }, { width: "440", height: 400 },
      { width: Infinity, height: 400 }, { width: 440, height: -1 }, { width: 440, height: 20001 }]) {
      assert.equal(normalizeContentSize(value), null);
    }
    assert.deepEqual(normalizeContentSize({ width: 439.1, height: 800.2, token: "ignored" }), { width: 440, height: 801 });
  });
  it("falls back from corrupt saved bounds and rejects unusable display geometry", () => {
    assert.deepEqual(selectWorkArea({ x: NaN }, [primary, secondary], primary.id), primary.workArea);
    assert.equal(fitWindowLayout({ x: NaN }, roomy, null).bounds.width, 440);
    assert.throws(() => selectWorkArea(null, [], 1), /No usable/);
    assert.throws(() => fitWindowLayout(null, { width: 0 }, null), /Invalid/);
  });
});
