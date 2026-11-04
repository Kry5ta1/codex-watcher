import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitContentScale } from "../lib/widget-layout.js";

describe("renderer content fit", () => {
  it("does not enlarge content in a larger window", () => {
    assert.equal(fitContentScale(440, 820, 800, 1000), 1);
  });
  it("fits tall themes, errors, settings and tickets without clipping", () => {
    for (const height of [560, 700, 850, 1100, 1400]) {
      const scale = fitContentScale(440, height, 440, 640);
      assert.ok(440 * scale <= 440);
      assert.ok(height * scale <= 640 + 1e-8);
    }
  });
  it("handles narrow high-DPI work areas in logical pixels", () => {
    assert.equal(fitContentScale(440, 800, 330, 600), 0.75);
    assert.equal(fitContentScale(440, 800, 440, 800, .8), .8);
  });
  it("safely handles initial zero measurements and invalid values", () => {
    assert.equal(fitContentScale(0, 0, 440, 800), 1);
    assert.equal(fitContentScale(NaN, 800, 440, 800), 1);
  });
});
