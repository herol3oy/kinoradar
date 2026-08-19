import assert from "node:assert/strict";
import test from "node:test";

import { parseShowFilters, serializeShowFilters } from "../src/lib/show-filter-params.ts";

const TODAY = "2026-01-30";
const VALID_DATES = [TODAY, "2026-01-31", "2026-02-01"];

function parse(search) {
  return parseShowFilters(new URLSearchParams(search), TODAY, VALID_DATES);
}

test("returns fully defaulted state for an empty query string", () => {
  assert.deepEqual(parse(""), {
    date: TODAY,
    query: "",
    cinema: "",
    fromTime: "",
    toTime: "",
    startingSoon: false,
    englishFriendly: false,
    view: "cinema",
    sort: "cinema",
  });
});

test("round-trips a fully populated state", () => {
  const state = {
    date: "2026-02-01",
    query: "dune",
    cinema: "Muranów",
    fromTime: "17:00",
    toTime: "21:00",
    startingSoon: true,
    englishFriendly: true,
    view: "film",
    sort: "time",
  };

  const params = serializeShowFilters(state, TODAY);
  assert.deepEqual(parseShowFilters(params, TODAY, VALID_DATES), state);
});

test("omits defaults from the serialized query string", () => {
  const params = serializeShowFilters(parse(""), TODAY);

  assert.equal(params.toString(), "");
});

test("serializes only the non-default keys", () => {
  const params = serializeShowFilters({ ...parse(""), query: "  dune  ", englishFriendly: true }, TODAY);

  assert.equal(params.toString(), "q=dune&en=1");
});

test("falls back to today for malformed or out-of-range dates", () => {
  assert.equal(parse("date=not-a-date").date, TODAY);
  assert.equal(parse("date=2019-01-01").date, TODAY);
  assert.equal(parse("date=2026-02-01").date, "2026-02-01");
});

test("coerces unknown view and sort values to their defaults", () => {
  assert.equal(parse("view=banana").view, "cinema");
  assert.equal(parse("sort=xyz").sort, "cinema");
  assert.equal(parse("view=film&sort=title").view, "film");
  assert.equal(parse("view=film&sort=title").sort, "title");
});

test("ignores malformed time values", () => {
  assert.equal(parse("from=99:99").fromTime, "");
  assert.equal(parse("to=7:00").toTime, "");
  assert.equal(parse("from=07:00&to=23:59").fromTime, "07:00");
  assert.equal(parse("from=07:00&to=23:59").toTime, "23:59");
});

test("parses boolean flags only from the literal 1", () => {
  assert.equal(parse("soon=1&en=1").startingSoon, true);
  assert.equal(parse("soon=1&en=1").englishFriendly, true);
  assert.equal(parse("soon=true&en=yes").startingSoon, false);
  assert.equal(parse("soon=true&en=yes").englishFriendly, false);
  assert.equal(parse("").startingSoon, false);
});

test("trims and caps an overlong search query", () => {
  const long = "a".repeat(200);

  assert.equal(parse(`q=%20%20dune%20%20`).query, "dune");
  assert.equal(parse(`q=${long}`).query.length, 80);
});
