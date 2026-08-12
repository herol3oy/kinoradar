import assert from "node:assert/strict";
import test from "node:test";

import { parseKinomuzeum } from "../src/lib/parsers/kinomuzeum.ts";

function term(overrides = {}) {
  return {
    parent: {
      uuid: "event-1",
      translations: {
        pl: { title: "  Zawieście\n czerwone latarnie  " },
      },
      thumbs: {
        list: { url: "/uploads/thumbs/poster.jpg" },
      },
    },
    dateFrom: "2026-08-12T00:00:00+02:00",
    timeFrom: "17:30",
    isAvailable: true,
    availablePlaces: 148,
    ticketUrl: "https://sklep.artmuseum.pl/rezerwacja/rezerwacja/nienumerowane.html?id=22916&idt=opaque-token",
    uuid: "term-1",
    parentUuid: "event-1",
    ...overrides,
  };
}

test("maps, groups, deduplicates, and sorts KINOMUZEUM cinema terms", async (t) => {
  const originalFetch = globalThis.fetch;
  let request;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input, init) => {
    request = { url: new URL(String(input)), init };
    return Response.json({
      "2026-08-11": [term({ uuid: "wrong-date" })],
      "2026-08-12": [
        term(),
        term({
          uuid: "term-2",
          timeFrom: "14:05",
          ticketUrl: null,
          isAvailable: false,
          availablePlaces: 0,
          parent: {
            uuid: "event-1",
            translations: { pl: { title: "Zawieście czerwone latarnie" } },
            thumbs: {},
          },
        }),
        term({ uuid: "term-1", timeFrom: "21:00" }),
        term({
          uuid: "term-3",
          parentUuid: "event-2",
          timeFrom: "12:00",
          ticketUrl: "http://example.com/insecure",
          parent: {
            uuid: "event-2",
            translations: { pl: { title: "Drugi film" } },
            thumbs: { list: { url: "https://images.example.com/second.jpg" } },
          },
        }),
        term({ uuid: "malformed", timeFrom: "25:99" }),
        null,
      ],
    });
  };

  const result = await parseKinomuzeum("2026-08-12");

  assert.equal(request.url.origin, "https://api-sf.artmuseum.pl");
  assert.equal(request.url.pathname, "/api/open/event_terms/calendar/2026-08-12/type/cinema");
  assert.equal(request.init.headers.Accept, "application/json");
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "Drugi film");
  assert.equal(result[0].poster, "https://images.example.com/second.jpg");
  assert.deepEqual(result[0].screenings, [{ time: "12:00" }]);
  assert.equal(result[1].title, "Zawieście czerwone latarnie");
  assert.equal(result[1].poster, "https://api-sf.artmuseum.pl/uploads/thumbs/poster.jpg");
  assert.deepEqual(result[1].screenings, [
    { time: "14:05" },
    {
      time: "17:30",
      link: "https://sklep.artmuseum.pl/rezerwacja/rezerwacja/nienumerowane.html?id=22916&idt=opaque-token",
    },
  ]);
});

test("uses the Warsaw calendar day for Date arguments", async (t) => {
  const originalFetch = globalThis.fetch;
  let request;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input) => {
    request = new URL(String(input));
    return Response.json({});
  };

  await parseKinomuzeum(new Date("2026-08-11T22:30:00Z"));
  assert.equal(request.pathname, "/api/open/event_terms/calendar/2026-08-12/type/cinema");
});

test("returns an empty schedule when the requested date is absent", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ "2026-08-13": [] });

  assert.deepEqual(await parseKinomuzeum("2026-08-12"), []);
});

test("rejects HTTP errors and invalid calendar responses", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  await assert.rejects(parseKinomuzeum("2026-08-12"), /KINOMUZEUM returned 503/);

  globalThis.fetch = async () => Response.json([]);
  await assert.rejects(parseKinomuzeum("2026-08-12"), /invalid response/);

  globalThis.fetch = async () => Response.json({ "2026-08-12": {} });
  await assert.rejects(parseKinomuzeum("2026-08-12"), /invalid response/);
});
