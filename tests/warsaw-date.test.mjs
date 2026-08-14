import assert from "node:assert/strict";
import test from "node:test";

import {
  addCalendarDays,
  normalizeWarsawDate,
  warsawDate,
  warsawDateRange,
  warsawMidnightEpochSeconds,
  warsawTimeMinutes,
} from "../src/lib/warsaw-date.ts";

test("uses the Warsaw calendar date during summer time", () => {
  assert.equal(warsawDate(new Date("2026-08-08T22:30:00Z")), "2026-08-09");
});

test("uses the Warsaw calendar date during winter time", () => {
  assert.equal(warsawDate(new Date("2026-01-01T23:30:00Z")), "2026-01-02");
});

test("uses Warsaw wall-clock minutes", () => {
  assert.equal(warsawTimeMinutes(new Date("2026-08-08T22:30:00Z")), 30);
});

test("constructs Warsaw midnight across DST boundaries", () => {
  assert.equal(new Date(warsawMidnightEpochSeconds("2026-01-15") * 1000).toISOString(), "2026-01-14T23:00:00.000Z");
  assert.equal(new Date(warsawMidnightEpochSeconds("2026-03-29") * 1000).toISOString(), "2026-03-28T23:00:00.000Z");
  assert.equal(new Date(warsawMidnightEpochSeconds("2026-10-25") * 1000).toISOString(), "2026-10-24T22:00:00.000Z");
  assert.throws(() => warsawMidnightEpochSeconds("2026-02-31"), /Invalid date key/);
});

test("adds calendar days across month and leap-year boundaries", () => {
  assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addCalendarDays("2028-02-28", 1), "2028-02-29");
});

test("builds the seven-day range from Warsaw today", () => {
  assert.deepEqual(warsawDateRange(3, new Date("2026-08-08T22:30:00Z")), [
    "2026-08-09",
    "2026-08-10",
    "2026-08-11",
  ]);
});

test("rejects impossible date keys", () => {
  assert.equal(
    normalizeWarsawDate("2026-02-31", new Date("2026-08-08T22:30:00Z")),
    "2026-08-09",
  );
});
