import assert from "node:assert/strict";
import test from "node:test";

import {
  kinokulturaBookingUrl,
  kinokulturaPosterUrl,
} from "../src/lib/kinokultura.ts";
import { parseKinokultura } from "../src/lib/parsers/kinokultura.ts";
import { screeningIdentity } from "../src/lib/screening-language.ts";
import { GET as getLiveScreenings } from "../src/pages/api/kinokultura/screenings.json.ts";
import {
  getKinokulturaLiveScreenings,
  parseKinokulturaScreeningIds,
} from "../src/server/kinokultura.ts";

function event(overrides = {}) {
  return {
    eventId: 52625,
    eventDetailId: 5594,
    eventTitle: "Kronika wypadków miłosnych (Kultura)",
    eventDateTime: "2026-08-14T18:00:00",
    imageId: 3028,
    linkActive: true,
    linkUrlParam: { event_id: 52625, typetran: 0 },
    msiFreeSeatsNumber: 214,
    msiTotalSeatsNumber: 234,
    isClosedSale: false,
    saleEnabled: true,
    saleDisabledTooltip: "Wyprzedano",
    details: {
      id: 5594,
      eventDetailUniqueNumber: 0,
      shortName: "Kronika wypadków miłosnych (Kultura)",
      dubbing: "DUB",
      additionalInfo: "DUB",
      is_2D: true,
      is_3D: false,
      imageId: 3028,
    },
    ...overrides,
  };
}

function html() {
  return `
    <div class="movies-movie">
      <div class="movies-movie__single__poster">
        <img onclick="showEventDetails('5594')" src="/MSI/ImageData.ashx?id=3028&amp;mode=thumb">
      </div>
      <h2 class="movies-movie__single__title">Kronika wypadków miłosnych (Kultura)</h2>
      <div class="movies-movie__single__options d-none d-md-block d-lg-flex">
        <ul class="js-event-hours">
          <li event-filter="52624"><span>15:00</span></li>
          <li event-filter="52625"><a data-event="52625" href="/MSI/Default.aspx?event_id=52625&amp;typetran=0">18:00</a></li>
        </ul>
      </div>
    </div>
  `;
}

test("uses Kino Kultura's MSI JSON feed with event-specific transaction modes", async () => {
  const requests = [];
  const fetcher = async (input, init) => {
    requests.push({ url: new URL(String(input)), init });
    return Response.json({ repertoireEvents: [
      event(),
      event({ eventId: 52626, eventDateTime: "2026-08-14T20:30:00", linkUrlParam: { event_id: 52626, typetran: 1 } }),
      event({ eventId: 52627, eventDateTime: "2026-08-15T18:00:00" }),
    ] });
  };

  const result = await parseKinokultura("2026-08-14", {
    fetcher,
    now: new Date("2026-08-12T12:00:00Z"),
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.hostname, "rezerwacja.kinokultura.pl");
  assert.equal(requests[0].url.pathname, "/MSI/mvc/pl/Repertoire/GetShortEventsWithFilters");
  assert.equal(requests[0].init.headers.Accept, "application/json");
  assert.equal(result.length, 1);
  assert.equal(result[0].poster, kinokulturaPosterUrl(3028));
  assert.deepEqual(result[0].screenings, [
    {
      time: "18:00",
      link: kinokulturaBookingUrl("52625", 0, "2026-08-14"),
      providerRef: { provider: "kinokultura", screeningId: "52625" },
      dubbed: true,
      presentation: { printType: "2D" },
    },
    {
      time: "20:30",
      link: kinokulturaBookingUrl("52626", 1, "2026-08-14"),
      providerRef: { provider: "kinokultura", screeningId: "52626" },
      dubbed: true,
      presentation: { printType: "2D" },
    },
  ]);
});

test("keeps inactive Kino Kultura events without exposing a checkout link", async () => {
  const result = await parseKinokultura("2026-08-14", {
    fetcher: async () => Response.json({ repertoireEvents: [event({
      linkActive: false,
      saleEnabled: false,
      msiFreeSeatsNumber: 0,
    })] }),
    now: new Date("2026-08-12T12:00:00Z"),
  });

  assert.equal(result[0].screenings[0].link, undefined);
  assert.deepEqual(result[0].screenings[0].providerRef, {
    provider: "kinokultura",
    screeningId: "52625",
  });
});

test("supplements today's Kino Kultura JSON with expired HTML events", async () => {
  const requests = [];
  const fetcher = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith("GetShortEventsWithFilters")) {
      return Response.json({ repertoireEvents: [event({
        eventDateTime: "2026-08-12T18:00:00",
        imageId: -1,
        details: { ...event().details, imageId: -1 },
      })] });
    }
    return new Response(html());
  };

  const result = await parseKinokultura("2026-08-12", {
    fetcher,
    now: new Date("2026-08-12T12:00:00Z"),
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get("date"), "2026-08-12");
  assert.equal(result.length, 1);
  assert.equal(result[0].poster, kinokulturaPosterUrl(3028));
  assert.deepEqual(result[0].screenings.map(({ time }) => time), ["15:00", "18:00"]);
  assert.deepEqual(result[0].screenings[0].providerRef, {
    provider: "kinokultura",
    screeningId: "52624",
  });
});

test("falls back to Kino Kultura HTML when JSON fails", async (t) => {
  t.mock.method(console, "error", () => {});
  const fetcher = async (input) => new URL(String(input)).pathname.endsWith("GetShortEventsWithFilters")
    ? new Response("unavailable", { status: 503 })
    : new Response(html());

  const result = await parseKinokultura("2026-08-14", { fetcher });

  assert.equal(result[0].screenings.length, 2);
  assert.equal(result[0].screenings[0].link, undefined);
  assert.deepEqual(result[0].screenings[1].providerRef, {
    provider: "kinokultura",
    screeningId: "52625",
  });
});

test("keeps Kino Kultura JSON if optional HTML enrichment fails", async (t) => {
  t.mock.method(console, "error", () => {});
  const fetcher = async (input) => new URL(String(input)).pathname.endsWith("GetShortEventsWithFilters")
    ? Response.json({ repertoireEvents: [event({ eventDateTime: "2026-08-12T18:00:00" })] })
    : new Response("unavailable", { status: 503 });

  const result = await parseKinokultura("2026-08-12", {
    fetcher,
    now: new Date("2026-08-12T12:00:00Z"),
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].screenings[0].providerRef.screeningId, "52625");
});

test("maps Kino Kultura live capacity in one MSI request", async () => {
  let requests = 0;
  const result = await getKinokulturaLiveScreenings(["52626", "52625", "99999"], async () => {
    requests += 1;
    return Response.json({ repertoireEvents: [
      event(),
      event({ eventId: 52626, msiFreeSeatsNumber: 0, saleEnabled: false }),
    ] });
  });

  assert.equal(requests, 1);
  assert.deepEqual(result.map(({ screeningId, seatsLeft, capacity, saleEnabled, soldOut }) => ({
    screeningId, seatsLeft, capacity, saleEnabled, soldOut,
  })), [
    { screeningId: "52626", seatsLeft: 0, capacity: 234, saleEnabled: false, soldOut: true },
    { screeningId: "52625", seatsLeft: 214, capacity: 234, saleEnabled: true, soldOut: false },
  ]);
});

test("validates Kino Kultura IDs and includes the provider in screening identity", () => {
  assert.deepEqual(parseKinokulturaScreeningIds("52625,52625, 52626"), ["52625", "52626"]);
  assert.throws(() => parseKinokulturaScreeningIds("52625,../../checkout"), /Invalid/);
  assert.throws(
    () => parseKinokulturaScreeningIds(Array.from({ length: 21 }, (_, index) => String(52000 + index)).join(",")),
    /Invalid/,
  );
  assert.equal(screeningIdentity({
    time: "18:00",
    providerRef: { provider: "kinokultura", screeningId: "52625" },
  }), "kinokultura:52625");
});

test("serves bounded Kino Kultura availability from its fixed upstream", async (t) => {
  const originalFetch = globalThis.fetch;
  const hosts = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    hosts.push(new URL(String(input)).hostname);
    return Response.json({ repertoireEvents: [event()] });
  };

  const invalid = await getLiveScreenings({
    request: new Request("https://kinoradar.pl/api/kinokultura/screenings.json?ids=invalid"),
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("Cache-Control"), "no-store");

  const response = await getLiveScreenings({
    request: new Request("https://kinoradar.pl/api/kinokultura/screenings.json?ids=52625"),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=30");
  assert.equal(hosts.at(-1), "rezerwacja.kinokultura.pl");
  assert.equal((await response.json())[0].seatsLeft, 214);
});
