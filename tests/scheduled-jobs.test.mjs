import assert from "node:assert/strict";
import test from "node:test";

import {
  FILMWEB_POPULAR_CRON,
  RELEASES_CRON,
  scheduledJobFor,
  TODAY_SCHEDULE_CRON,
  TOMORROW_SCHEDULE_CRON,
} from "../src/server/scheduled-jobs.ts";

test("routes each configured cron trigger to one job", () => {
  assert.deepEqual(scheduledJobFor(TODAY_SCHEDULE_CRON), { kind: "schedule", dayOffset: 0 });
  assert.deepEqual(scheduledJobFor(TOMORROW_SCHEDULE_CRON), { kind: "schedule", dayOffset: 1 });
  assert.deepEqual(scheduledJobFor(RELEASES_CRON), { kind: "releases" });
  assert.deepEqual(scheduledJobFor(FILMWEB_POPULAR_CRON), { kind: "filmweb" });
});

test("rejects unconfigured cron triggers", () => {
  assert.equal(scheduledJobFor("40 */4 * * *"), null);
});
