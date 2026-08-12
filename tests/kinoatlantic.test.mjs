import assert from "node:assert/strict";
import test from "node:test";

import { novekinoBookingUrl } from "../src/lib/novekino.ts";
import { parseNovekinoCinema } from "../src/lib/parsers/novekino.ts";
import { screeningIdentity } from "../src/lib/screening-language.ts";
import { GET as getLiveScreenings } from "../src/pages/api/novekino/screenings.json.ts";

function atlanticEvent(overrides = {}) {
  return {
    eventId: 47026,
    eventTitle: "Odyseja - napisy",
    eventDateTime: "2026-08-12T20:00:00",
    imageId: 2721,
    msiFreeSeatsNumber: 88,
    msiTotalSeatsNumber: 221,
    isClosedSale: false,
    saleEnabled: true,
    details: {
      eventDetailUniqueNumber: 19781,
      shortName: "Odyseja - napisy",
      dubbing: "NAP",
      is_2D: true,
      is_3D: false,
      imageId: 2721,
    },
    ...overrides,
  };
}

function atlanticHtml() {
  return `
    <table><tr class="repertoire-movie-tr">
      <td><div class="repertoire-movie-poster"><img src="/multimedia/odyseja/plakat.jpg"></div>
      <div class="repertoire-movie-title"><a href="film.php?id=19781">Odyseja</a></div></td>
      <td><span class="repertoire-movie-time" data-hour="13:00">13:00</span></td>
      <td><a class="repertoire-movie-time" data-hour="20:00"
        data-buy-link="https://atlantic.novekino.pl/msi/default.aspx?event_id=47026&amp;typetran=0">20:00</a></td>
    </tr></table>
  `;
}

test("uses Atlantic's own NoveKino tenant for future schedule data", async () => {
  const requests = [];
  const fetcher = async (input, init) => {
    requests.push({ url: new URL(String(input)), init });
    return Response.json({
      repertoireEvents: [atlanticEvent({ eventDateTime: "2026-08-14T18:45:00" })],
    });
  };

  const result = await parseNovekinoCinema("atlantic", "2026-08-14", {
    fetcher,
    now: new Date("2026-08-12T12:00:00Z"),
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.hostname, "atlantic.novekino.pl");
  assert.equal(requests[0].url.pathname, "/MSI/mvc/pl/Repertoire/GetShortEventsWithFilters");
  assert.equal(requests[0].init.headers.Accept, "application/json");
  assert.equal(result[0].link, "https://www.novekino.pl/kina/atlantic/film.php?id=19781");
  assert.equal(result[0].poster, "https://atlantic.novekino.pl/MSI/ImageData.ashx?id=2721&mode=thumb");
  assert.deepEqual(result[0].screenings, [{
    time: "18:45",
    link: novekinoBookingUrl("atlantic", "47026"),
    providerRef: { provider: "novekino", cinema: "atlantic", screeningId: "47026" },
    subtitled: true,
    presentation: { printType: "2D" },
  }]);
});

test("supplements today's Atlantic JSON with expired HTML screenings and public artwork", async () => {
  const requests = [];
  const fetcher = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.hostname === "atlantic.novekino.pl") {
      return Response.json({ repertoireEvents: [atlanticEvent({ imageId: -1, details: {
        ...atlanticEvent().details,
        imageId: -1,
      } })] });
    }
    return new Response(atlanticHtml(), { headers: { "Content-Type": "text/html" } });
  };

  const result = await parseNovekinoCinema("atlantic", "2026-08-12", {
    fetcher,
    now: new Date("2026-08-12T12:00:00Z"),
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get("data"), "2026-08-12");
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Odyseja");
  assert.equal(result[0].poster, "https://www.novekino.pl/multimedia/odyseja/plakat.jpg");
  assert.deepEqual(result[0].screenings.map(({ time }) => time), ["13:00", "20:00"]);
  assert.equal(result[0].screenings[0].providerRef, undefined);
  assert.deepEqual(result[0].screenings[1].providerRef, {
    provider: "novekino",
    cinema: "atlantic",
    screeningId: "47026",
  });
  assert.equal(result[0].screenings[1].subtitled, true);
});

test("falls back to Atlantic HTML when its JSON feed fails", async (t) => {
  t.mock.method(console, "error", () => {});
  const fetcher = async (input) => {
    const url = new URL(String(input));
    return url.hostname === "atlantic.novekino.pl"
      ? new Response("unavailable", { status: 503 })
      : new Response(atlanticHtml());
  };

  const result = await parseNovekinoCinema("atlantic", "2026-08-14", {
    fetcher,
    now: new Date("2026-08-12T12:00:00Z"),
  });

  assert.equal(result[0].title, "Odyseja");
  assert.equal(result[0].screenings.length, 2);
  assert.deepEqual(result[0].screenings[1].providerRef, {
    provider: "novekino",
    cinema: "atlantic",
    screeningId: "47026",
  });
});

test("keeps today's Atlantic JSON when optional HTML enrichment fails", async (t) => {
  t.mock.method(console, "error", () => {});
  const fetcher = async (input) => new URL(String(input)).hostname === "atlantic.novekino.pl"
    ? Response.json({ repertoireEvents: [atlanticEvent()] })
    : new Response("unavailable", { status: 503 });

  const result = await parseNovekinoCinema("atlantic", "2026-08-12", {
    fetcher,
    now: new Date("2026-08-12T12:00:00Z"),
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].screenings[0].providerRef.screeningId, "47026");
});

test("includes the NoveKino tenant in screening identities", () => {
  const wisla = { time: "18:00", providerRef: { provider: "novekino", cinema: "wisla", screeningId: "47026" } };
  const atlantic = { time: "18:00", providerRef: { provider: "novekino", cinema: "atlantic", screeningId: "47026" } };
  assert.notEqual(screeningIdentity(wisla), screeningIdentity(atlantic));
});

test("routes Atlantic live availability only to its allowlisted ticket tenant", async (t) => {
  const originalFetch = globalThis.fetch;
  const hosts = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    hosts.push(new URL(String(input)).hostname);
    return Response.json({ repertoireEvents: [atlanticEvent()] });
  };

  const response = await getLiveScreenings({
    request: new Request("https://kinoradar.pl/api/novekino/screenings.json?cinema=atlantic&ids=47026"),
  });

  assert.equal(response.status, 200);
  assert.equal(hosts.at(-1), "atlantic.novekino.pl");
  assert.equal((await response.json())[0].screeningId, "47026");
});
