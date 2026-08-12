import assert from "node:assert/strict";
import test from "node:test";

import { parseKinowisla } from "../src/lib/parsers/kinowisla.ts";
import { favoriteKey } from "../src/lib/favorites.ts";
import { normalizeShow } from "../src/lib/normalize.ts";
import { novekinoBookingUrl } from "../src/lib/novekino.ts";
import { screeningIdentity } from "../src/lib/screening-language.ts";
import { GET as getLiveScreenings } from "../src/pages/api/novekino/screenings.json.ts";
import {
  getNovekinoLiveScreenings,
  parseNovekinoScreeningIds,
} from "../src/server/novekino.ts";

function event(overrides = {}) {
  return {
    eventId: 114029,
    eventTitle: "Historie równoległe - napisy",
    eventDateTime: "2026-08-14T20:10:00",
    imageId: 3010,
    msiFreeSeatsNumber: 117,
    msiTotalSeatsNumber: 120,
    isClosedSale: false,
    saleEnabled: true,
    saleDisabledTooltip: "Wyprzedano",
    details: {
      shortName: "Historie równoległe - napisy",
      dubbing: "NAP",
      additionalInfo: "NAP",
      is_2D: true,
      is_3D: false,
      imageId: 3010,
    },
    ...overrides,
  };
}

test("uses the NoveKino ticketing JSON as Wisła's primary schedule source", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input, init) => {
    requests.push({ url: new URL(String(input)), init });
    return Response.json({
      repertoireEvents: [
        event(),
        event({ eventId: 114030, eventDateTime: "2026-08-14T11:10:00" }),
        event({ eventId: 114046, eventDateTime: "2026-08-15T20:10:00" }),
        event({ eventId: "invalid", eventTitle: "Malformed" }),
      ],
    });
  };

  const result = await parseKinowisla("2026-08-14");

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, "/MSI/mvc/pl/Repertoire/GetShortEventsWithFilters");
  assert.equal(requests[0].init.headers.Accept, "application/json");
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Historie równoległe - napisy");
  assert.equal(result[0].poster, "https://wisla.novekino.pl/MSI/ImageData.ashx?id=3010&mode=thumb");
  assert.deepEqual(result[0].screenings.map((screening) => screening.time), ["11:10", "20:10"]);
  assert.deepEqual(result[0].screenings[1], {
    time: "20:10",
    link: novekinoBookingUrl("114029"),
    providerRef: { provider: "novekino", screeningId: "114029" },
    subtitled: true,
    presentation: { printType: "2D" },
  });

  const normalized = normalizeShow(result[0], "Wisła", "kinowisla");
  assert.equal(normalized.canonicalTitle, "Historie równoległe");
  assert.equal(normalized.screenings[0].providerRef.provider, "novekino");
});

test("falls back to Wisła HTML and preserves event-specific purchase links", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  t.mock.method(console, "error", () => {});

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.hostname === "wisla.novekino.pl") return new Response("unavailable", { status: 503 });
    return new Response(`
      <table><tr class="repertoire-movie-tr">
        <td><div class="repertoire-movie-poster"><img src="/multimedia/historie/plakat.jpg"></div>
        <div class="repertoire-movie-title"><a href="film.php?id=19959">Historie równoległe - napisy</a></div></td>
        <td><a class="repertoire-movie-time" data-hour="20:10"
          data-buy-link="https://wisla.novekino.pl/msi/default.aspx?event_id=114029&amp;typetran=0">20:10</a></td>
      </tr></table>
    `, { headers: { "Content-Type": "text/html" } });
  };

  const result = await parseKinowisla("2026-08-14");

  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get("data"), "2026-08-14");
  assert.equal(result[0].link, "https://www.novekino.pl/kina/wisla/film.php?id=19959");
  assert.equal(result[0].poster, "https://www.novekino.pl/multimedia/historie/plakat.jpg");
  assert.deepEqual(result[0].screenings, [{
    time: "20:10",
    link: "https://wisla.novekino.pl/msi/default.aspx?event_id=114029&typetran=0",
    providerRef: { provider: "novekino", screeningId: "114029" },
  }]);
});

test("maps live Wisła capacity in one repertoire request", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests += 1;
    return Response.json({
      repertoireEvents: [
        event(),
        event({
          eventId: 114030,
          msiFreeSeatsNumber: 0,
          msiTotalSeatsNumber: 120,
          saleEnabled: false,
          saleDisabledTooltip: "Wyprzedano",
        }),
        event({
          eventId: 114031,
          msiFreeSeatsNumber: 20,
          isClosedSale: true,
          saleEnabled: true,
        }),
        event({ eventId: 999999, msiFreeSeatsNumber: 20 }),
      ],
    });
  };

  const result = await getNovekinoLiveScreenings(["114030", "114029", "114031", "123456"], fetcher);

  assert.equal(requests, 1);
  assert.deepEqual(result.map(({ screeningId, seatsLeft, capacity, saleEnabled, soldOut }) => ({
    screeningId, seatsLeft, capacity, saleEnabled, soldOut,
  })), [
    { screeningId: "114030", seatsLeft: 0, capacity: 120, saleEnabled: false, soldOut: true },
    { screeningId: "114029", seatsLeft: 117, capacity: 120, saleEnabled: true, soldOut: false },
    { screeningId: "114031", seatsLeft: 20, capacity: 120, saleEnabled: false, soldOut: false },
  ]);
  assert.ok(result.every((screening) => !Number.isNaN(Date.parse(screening.fetchedAt))));
});

test("validates, deduplicates, and limits Wisła live screening IDs", () => {
  assert.deepEqual(parseNovekinoScreeningIds("114029,114029, 114030"), ["114029", "114030"]);
  assert.throws(() => parseNovekinoScreeningIds(null), /Missing/);
  assert.throws(() => parseNovekinoScreeningIds("114029,../../checkout"), /Invalid/);
  assert.throws(
    () => parseNovekinoScreeningIds(Array.from({ length: 21 }, (_, index) => String(100000 + index)).join(",")),
    /Invalid/,
  );
});

test("keeps Wisła screening identities distinct without changing favorite keys", () => {
  const show = normalizeShow({
    title: "Film",
    screenings: [
      { time: "18:00", providerRef: { provider: "novekino", screeningId: "114029" } },
      { time: "18:00", providerRef: { provider: "novekino", screeningId: "114030" } },
    ],
  }, "Wisła", "kinowisla");

  assert.equal(show.screenings.length, 2);
  assert.notEqual(screeningIdentity(show.screenings[0]), screeningIdentity(show.screenings[1]));
  assert.equal(
    favoriteKey("Film", "2026-08-14", "18:00", "Wisła", show.screenings[0], "kinowisla"),
    favoriteKey("Film", "2026-08-14", "18:00", "Wisła", show.screenings[1], "kinowisla"),
  );
});

test("serves bounded Wisła live availability through the public API route", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ repertoireEvents: [event()] });

  const invalid = await getLiveScreenings({
    request: new Request("https://kinoradar.pl/api/novekino/screenings.json?ids=invalid"),
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("Cache-Control"), "no-store");

  const response = await getLiveScreenings({
    request: new Request("https://kinoradar.pl/api/novekino/screenings.json?ids=114029"),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=30");
  const body = await response.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].screeningId, "114029");
  assert.equal(body[0].seatsLeft, 117);

  t.mock.method(console, "error", () => {});
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  const unavailable = await getLiveScreenings({
    request: new Request("https://kinoradar.pl/api/novekino/screenings.json?ids=114029"),
  });
  assert.equal(unavailable.status, 502);
  assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
});
