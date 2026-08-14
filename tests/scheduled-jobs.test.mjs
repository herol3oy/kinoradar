import assert from "node:assert/strict";
import test from "node:test";

import {
  RELEASES_CRON,
  scheduledJobFor,
  TODAY_SCHEDULE_CRON,
  TOMORROW_SCHEDULE_CRON,
} from "../src/server/scheduled-jobs.ts";

test("routes each configured cron trigger to one job", () => {
  assert.deepEqual(scheduledJobFor(TODAY_SCHEDULE_CRON), { kind: "schedule", dayOffset: 0 });
  assert.deepEqual(scheduledJobFor(TOMORROW_SCHEDULE_CRON), { kind: "schedule", dayOffset: 1 });
  assert.deepEqual(scheduledJobFor(RELEASES_CRON), { kind: "releases" });
});

test("rejects unconfigured cron triggers", () => {
  assert.equal(scheduledJobFor("30 */4 * * *"), null);
});
