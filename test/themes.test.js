import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { APPEARANCE_KEY, THEME_OPTIONS, normalizeAppearance, parseAppearance } from "../lib/themes.js";

describe("appearance settings", () => {
  it("keeps the classic layout as the default", () => {
    assert.deepEqual(normalizeAppearance(null), { theme: "classic", focusMode: false });
    assert.equal(APPEARANCE_KEY, "codex-watcher-appearance-v1");
  });
  it("accepts only the known themes and a boolean focus setting", () => {
    for (const theme of ["classic", "whale", "dragon"]) {
      assert.deepEqual(normalizeAppearance({ theme, focusMode: true, token: "discard" }), { theme, focusMode: true });
    }
    for (const theme of ["unknown", "__proto__", "DRAGON", "", 1, null]) {
      assert.equal(normalizeAppearance({ theme }).theme, "classic");
    }
    assert.equal(normalizeAppearance({ theme: "dragon", focusMode: "true" }).focusMode, false);
  });
  it("round-trips both themes and focus mode through local storage", () => {
    for (const theme of ["whale", "dragon"]) {
      for (const focusMode of [true, false]) {
        const value = { theme, focusMode };
        assert.deepEqual(parseAppearance(JSON.stringify(value)), value);
      }
    }
  });
  it("falls back safely for malformed, missing, or old saved settings", () => {
    for (const raw of [null, undefined, "{broken", "null", "[]", '"whale"', '{"theme":"retired"}']) {
      assert.deepEqual(parseAppearance(raw), { theme: "classic", focusMode: false });
    }
  });
  it("provides two local transparent mascot PNGs and no remote image requests", () => {
    assert.equal(THEME_OPTIONS.length, 3);
    const characters = THEME_OPTIONS.filter((theme) => theme.image);
    assert.equal(characters.length, 2);
    for (const theme of characters) {
      assert.match(theme.image, /^\/themes\/[a-z-]+\.png$/);
      assert.ok(theme.alt.length > 10);
      const data = readFileSync(new URL(`../public${theme.image}`, import.meta.url));
      assert.equal(data.subarray(1, 4).toString(), "PNG");
      assert.equal(data[25], 6, "PNG must retain RGBA transparency");
      assert.ok(data.length < 2_000_000, "Keep the local mascot asset compact");
    }
  });
});
