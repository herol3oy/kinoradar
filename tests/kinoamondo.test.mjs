import assert from "node:assert/strict";
import test from "node:test";

import { parseKinoamondo } from "../src/lib/parsers/kinoamondo.ts";

const LOCATION_ID = "0195ccae-6dc3-7160-b0b2-ca864fb95dcc";

function event(overrides = {}) {
  return {
    id: "352685",
    title: "Aftersun",
    displayPeriod: { startsAt: "2026-08-12T18:00:00+02:00" },
    cancelled: false,
    show: {
      id: "30561",
      slug: "aftersun-amondo",
      pictures: [{ id: "poster-id" }],
    },
    location: { id: LOCATION_ID },
    ...overrides,
  };
}

test("maps and groups paginated Kicket events into Amondo screenings", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  const firstPage = [
    event(),
    ...Array.from({ length: 49 }, (_, index) => event({
      id: `cancelled-${index}`,
      cancelled: true,
    })),
  ];
  const secondPage = [
    event({
      id: "352684",
      displayPeriod: { startsAt: "2026-08-12T15:30:00+02:00" },
      show: { id: "30561", slug: "aftersun-amondo", pictures: [] },
    }),
    event({ id: "wrong-day", displayPeriod: { startsAt: "2026-08-13T00:30:00+02:00" } }),
    event({ id: "malformed", title: "" }),
  ];

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    return Response.json(url.searchParams.get("page") === "0" ? firstPage : secondPage);
  };

  const result = await parseKinoamondo("2026-08-12");

  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Aftersun");
  assert.equal(result[0].poster, "https://biletomat.pl/api/images/poster-id");
  assert.deepEqual(result[0].screenings.map(({ time }) => time), ["15:30", "18:00"]);
  assert.equal(
    result[0].screenings[0].link,
    `https://biletomat.pl/wydarzenia/aftersun-amondo-30561?locationId=${LOCATION_ID}&eventId=352684`,
  );

  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(({ url }) => url.searchParams.get("page")), ["0", "1"]);
  assert.ok(requests.every(({ url }) => url.origin === "https://api.kicket.com"));
  assert.ok(requests.every(({ url }) => url.pathname === "/marketplace/events/listing"));
  assert.ok(requests.every(({ url }) => url.searchParams.get("size") === "50"));
  assert.ok(requests.every(({ url }) => url.searchParams.get("location") === LOCATION_ID));
  assert.ok(requests.every(({ url }) => url.searchParams.get("dateRange.from") === "2026-08-12"));
  assert.ok(requests.every(({ url }) => url.searchParams.get("dateRange.to") === "2026-08-12"));
  assert.ok(requests.every(({ init }) => init.headers.Accept === "application/json"));
});

test("uses the Warsaw calendar day for Date arguments", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let request;
  globalThis.fetch = async (input) => {
    request = new URL(String(input));
    return Response.json([]);
  };

  await parseKinoamondo(new Date("2026-08-11T22:30:00Z"));
  assert.equal(request.searchParams.get("dateRange.from"), "2026-08-12");
  assert.equal(request.searchParams.get("dateRange.to"), "2026-08-12");
});

test("rejects HTTP errors and invalid top-level API responses", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  await assert.rejects(parseKinoamondo("2026-08-12"), /Kino Amondo returned 503/);

  globalThis.fetch = async () => Response.json({ events: [] });
  await assert.rejects(parseKinoamondo("2026-08-12"), /invalid response/);
});
