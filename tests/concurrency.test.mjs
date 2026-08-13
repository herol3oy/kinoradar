import assert from "node:assert/strict";
import test from "node:test";

import { allSettledConcurrent } from "../src/server/concurrency.ts";

test("settles jobs in input order without exceeding the concurrency limit", async () => {
  let active = 0;
  let maxActive = 0;

  const results = await allSettledConcurrent([0, 1, 2, 3, 4, 5], 3, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, value % 2 ? 1 : 3));
    active -= 1;
    if (value === 2) throw new Error("expected failure");
    return value * 10;
  });

  assert.equal(maxActive, 3);
  assert.deepEqual(results.map((result) => result.status), [
    "fulfilled",
    "fulfilled",
    "rejected",
    "fulfilled",
    "fulfilled",
    "fulfilled",
  ]);
  assert.deepEqual(
    results.map((result) => result.status === "fulfilled" ? result.value : result.reason.message),
    [0, 10, "expected failure", 30, 40, 50],
  );
});

test("rejects an invalid concurrency limit", async () => {
  await assert.rejects(allSettledConcurrent([1], 0, async (value) => value), /positive integer/);
});
