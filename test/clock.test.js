import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANNOUNCEMENT_TIME_ZONE, formatAnnouncementClock } from "../lib/clock.js";

describe("announcement reference clock", () => {
  it("uses the IANA Pacific zone rather than a fixed offset", () => {
    assert.equal(ANNOUNCEMENT_TIME_ZONE, "America/Los_Angeles");
    const winter = formatAnnouncementClock("2026-01-15T20:05:09Z");
    assert.equal(winter.time, "12:05");
    assert.equal(winter.seconds, "09");
    assert.equal(winter.period, "PM");
    assert.equal(winter.zone, "PST");
    assert.equal(winter.offset, "UTC-8");
    const summer = formatAnnouncementClock("2026-07-15T19:05:09Z");
    assert.equal(summer.time, "12:05");
    assert.equal(summer.zone, "PDT");
    assert.equal(summer.offset, "UTC-7");
  });

  it("jumps from 1:59:59 AM PST to 3:00 AM PDT at spring transition", () => {
    const before = formatAnnouncementClock("2026-03-08T09:59:59Z");
    const after = formatAnnouncementClock("2026-03-08T10:00:00Z");
    assert.deepEqual([before.time, before.seconds, before.zone], ["01:59", "59", "PST"]);
    assert.deepEqual([after.time, after.seconds, after.zone], ["03:00", "00", "PDT"]);
  });

  it("labels the repeated autumn hour correctly", () => {
    const before = formatAnnouncementClock("2026-11-01T08:59:59Z");
    const after = formatAnnouncementClock("2026-11-01T09:00:00Z");
    assert.deepEqual([before.time, before.zone, before.offset], ["01:59", "PDT", "UTC-7"]);
    assert.deepEqual([after.time, after.zone, after.offset], ["01:00", "PST", "UTC-8"]);
  });

  it("displays local dates, midnight and noon unambiguously", () => {
    const midnight = formatAnnouncementClock("2026-11-03T08:00:00Z");
    assert.deepEqual([midnight.time, midnight.period, midnight.date], ["12:00", "AM", "Tue, Nov 3"]);
    const noon = formatAnnouncementClock("2026-11-03T20:00:00Z");
    assert.deepEqual([noon.time, noon.period], ["12:00", "PM"]);
    const previousDay = formatAnnouncementClock("2026-01-01T07:59:59Z");
    assert.equal(previousDay.date, "Wed, Dec 31");
    assert.equal(previousDay.iso, "2026-01-01T07:59:59.000Z");
  });

  it("does not depend on the computer's local timezone", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["Asia/Shanghai", "UTC", "America/New_York"]) {
        process.env.TZ = tz;
        assert.equal(formatAnnouncementClock("2026-07-15T19:05:09Z").time, "12:05");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("provides stable placeholders for pre-mount and invalid dates", () => {
    for (const value of [null, undefined, "invalid", new Date(NaN)]) {
      assert.equal(formatAnnouncementClock(value), null);
    }
    assert.match(formatAnnouncementClock("2026-11-03T20:05:09Z").accessible, /12:05:09 PM PST/);
  });
});
