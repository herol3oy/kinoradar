import assert from "node:assert/strict";
import test from "node:test";

import { setCachedShows } from "../src/server/kv.ts";

test("uses a 24-hour TTL for complete schedules", async () => {
  let options;
  const kv = { put: async (_key, _value, init) => { options = init; } };

  await setCachedShows(kv, "2026-08-13", [], []);
  assert.equal(options.expirationTtl, 86_400);
});

test("uses a 30-minute TTL for partial schedules", async () => {
  let options;
  const kv = { put: async (_key, _value, init) => { options = init; } };

  const data = await setCachedShows(kv, "2026-08-13", [], ["Kinokawiarnia Stacja Falenica"]);
  assert.equal(options.expirationTtl, 1_800);
  assert.deepEqual(data.failedCinemas, ["Kinokawiarnia Stacja Falenica"]);
});
