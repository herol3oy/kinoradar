import assert from "node:assert/strict";
import test from "node:test";

import { cinemas, getCinema } from "../src/data/cinemas.ts";
import { getCachedSchedule, SCHEDULE_SCHEMA_VERSION } from "../src/server/kv.ts";

test("registers every cinema in the complete cinema catalog", () => {
  assert.equal(cinemas.length, 23);
  assert.deepEqual(getCinema("kinomuzeum"), {
    slug: "kinomuzeum",
    name: "KINOMUZEUM",
    label: "KINOMUZEUM",
  });
  assert.ok(cinemas.map((cinema) => cinema.name).includes("KINOMUZEUM"));
  assert.deepEqual(getCinema("kinopraha"), {
    slug: "kinopraha",
    name: "Praha",
    label: "Kino Praha",
  });
  assert.ok(cinemas.map((cinema) => cinema.name).includes("Praha"));
  assert.deepEqual(
    cinemas.filter((cinema) => cinema.slug.startsWith("multikino-")).map((cinema) => cinema.name),
    [
      "Multikino G City Reduta",
      "Multikino Młociny",
      "Multikino G City Targówek",
      "Multikino Wola Park",
      "Multikino Złote Tarasy",
    ],
  );
  assert.equal(cinemas.some((cinema) => cinema.slug.startsWith("cinema-city-")), false);
  assert.equal(getCinema("cinema-city-arkadia"), undefined);
  assert.deepEqual(
    cinemas.slice(-4).map((cinema) => cinema.name),
    ["Helios Blue City", "Kino Głębocka 66", "Kino na boku", "Kinokawiarnia Stacja Falenica"],
  );
});

test("invalidates schedules cached before the latest cinema catalog change", async () => {
  const oldCache = {
    get: async () => ({
      schemaVersion: SCHEDULE_SCHEMA_VERSION - 1,
      shows: [],
      updatedAt: null,
      failedCinemas: [],
    }),
  };

  assert.equal(await getCachedSchedule(oldCache, "2026-08-12"), null);
});
