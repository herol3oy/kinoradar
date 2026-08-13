import assert from "node:assert/strict";
import test from "node:test";

import { cinemas, getCinema } from "../src/data/cinemas.ts";
import { getCachedSchedule, SCHEDULE_SCHEMA_VERSION } from "../src/server/kv.ts";

test("registers every cinema in the complete cinema catalog", () => {
  assert.equal(cinemas.length, 26);
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
  assert.deepEqual(
    cinemas.filter((cinema) => cinema.slug.startsWith("cinema-city-")).map((cinema) => cinema.name),
    [
      "Cinema City Arkadia",
      "Cinema City Bemowo",
      "Cinema City Galeria Północna",
      "Cinema City Janki",
      "Cinema City Mokotów",
      "Cinema City Promenada",
      "Cinema City Sadyba",
    ],
  );
});

test("invalidates schedules cached before the latest cinema integration", async () => {
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
