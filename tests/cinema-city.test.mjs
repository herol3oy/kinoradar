import assert from "node:assert/strict";
import test from "node:test";

import { CINEMA_CITY_CINEMAS } from "../src/lib/cinema-city.ts";
import { normalizeShow } from "../src/lib/normalize.ts";
import { parseCinemaCityCinema } from "../src/lib/parsers/cinema-city.ts";
import { createCinemaCityClient } from "../src/server/cinema-city.ts";

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

test("requests the exact public Cinema City feed for all seven venues", async () => {
  const requests = [];
  const client = createCinemaCityClient(async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({
      path: url.pathname,
      attr: url.searchParams.get("attr"),
      lang: url.searchParams.get("lang"),
      accept: new Headers(init.headers).get("Accept"),
    });
    return jsonResponse({ body: { films: [], events: [] } });
  });

  await Promise.all(CINEMA_CITY_CINEMAS.map((cinema) =>
    client.getShowings(cinema.cinemaId, "2026-08-13")));

  assert.equal(requests.length, 7);
  assert.deepEqual(
    requests.map((request) => request.path).sort(),
    CINEMA_CITY_CINEMAS.map((cinema) =>
      `/pl/data-api-service/v1/quickbook/10103/film-events/in-cinema/${cinema.cinemaId}/at-date/2026-08-13`).sort(),
  );
  requests.forEach((request) => {
    assert.equal(request.attr, "");
    assert.equal(request.lang, "pl-PL");
    assert.equal(request.accept, "application/json;charset=utf-8");
  });
});

test("maps Cinema City sessions, languages, formats, and online-sale state", async () => {
  const payload = {
    body: {
      films: [
        {
          id: "film1",
          name: "Odyseja",
          link: "https://www.cinema-city.pl/filmy/odyseja/film1",
          posterLink: "https://www.cinema-city.pl/xmedia-cw/repo/feats/posters/FILM1.jpg",
        },
        { id: "broken", name: "", link: "https://example.com/unsafe" },
      ],
      events: [
        {
          id: "501",
          filmId: "film1",
          cinemaId: "1074",
          businessDay: "2026-08-13",
          eventDateTime: "2026-08-13T18:00:00",
          attributeIds: ["2d", "original-lang-en", "first-subbed-lang-pl", "subbed", "laser-barco"],
          languages: { original: ["en"], dubbed: [], voiceover: [], subtitles: ["pl"] },
          bookingRouterLaunchLink: "https://www.cinema-city.pl/pl/booking-router/launch/501?lang=pl",
          soldOut: false,
          compositeBookingLink: { blockOnlineSales: false },
        },
        {
          id: "502",
          filmId: "film1",
          cinemaId: "1074",
          businessDay: "2026-08-13",
          eventDateTime: "2026-08-13T18:00:00",
          attributeIds: ["3d", "4dx", "dubbed", "dubbed-lang-uk"],
          languages: { original: ["en"], dubbed: ["uk"], voiceover: [], subtitles: [] },
          bookingRouterLaunchLink: "https://www.cinema-city.pl/pl/booking-router/launch/502?lang=pl-PL",
          soldOut: false,
          compositeBookingLink: { blockOnlineSales: false },
        },
        {
          id: "503",
          filmId: "film1",
          cinemaId: "1074",
          businessDay: "2026-08-13",
          eventDateTime: "2026-08-13T20:15:00",
          attributeIds: ["2d", "original-lang-pl"],
          languages: { original: ["pl"], dubbed: [], voiceover: [], subtitles: [] },
          bookingRouterLaunchLink: "https://www.cinema-city.pl/pl/booking-router/launch/503?lang=pl",
          soldOut: true,
          compositeBookingLink: { blockOnlineSales: false },
        },
        {
          id: "504",
          filmId: "film1",
          cinemaId: "1074",
          businessDay: "2026-08-13",
          eventDateTime: "2026-08-13T21:30:00",
          attributeIds: ["2d", "dolby-atmos"],
          languages: { original: ["en"], dubbed: [], voiceover: [], subtitles: [] },
          bookingRouterLaunchLink: "https://www.cinema-city.pl/pl/booking-router/launch/504?lang=pl",
          soldOut: false,
          compositeBookingLink: { blockOnlineSales: true },
        },
        {
          id: "505",
          filmId: "film1",
          cinemaId: "1074",
          businessDay: "2026-08-14",
          eventDateTime: "2026-08-14T10:00:00",
        },
        {
          id: "506",
          filmId: "film1",
          cinemaId: "1061",
          businessDay: "2026-08-13",
          eventDateTime: "2026-08-13T10:00:00",
        },
        { id: "invalid", filmId: "film1", cinemaId: "1074", businessDay: "2026-08-13", eventDateTime: "2026-08-13T10:00:00" },
        { id: "501", filmId: "film1", cinemaId: "1074", businessDay: "2026-08-13", eventDateTime: "2026-08-13T23:00:00" },
        { id: "507", filmId: "missing", cinemaId: "1074", businessDay: "2026-08-13", eventDateTime: "2026-08-13T10:00:00" },
      ],
    },
  };
  const client = {
    async getShowings(cinemaId, day) {
      assert.equal(cinemaId, "1074");
      assert.equal(day, "2026-08-13");
      return payload;
    },
  };

  const shows = await parseCinemaCityCinema("arkadia", "2026-08-13", { client });
  assert.equal(shows.length, 1);
  assert.equal(shows[0].title, "Odyseja");
  assert.equal(shows[0].link, "https://www.cinema-city.pl/filmy/odyseja/film1");
  assert.equal(shows[0].screenings.length, 4);

  const [subtitledLaser, dubbed4dx, soldOut, blocked] = shows[0].screenings;
  assert.deepEqual(subtitledLaser, {
    time: "18:00",
    link: "https://www.cinema-city.pl/pl/booking-router/launch/501?lang=pl",
    language: { audioLanguage: "en", subtitleLanguages: ["pl"], subtitled: true },
    presentation: { printType: "2D", format: "LASER BARCO", screenFeatures: ["LASER BARCO"] },
    providerRef: { provider: "cinema-city", cinema: "arkadia", screeningId: "501" },
  });
  assert.deepEqual(dubbed4dx, {
    time: "18:00",
    link: "https://www.cinema-city.pl/pl/booking-router/launch/502?lang=pl-PL",
    language: { audioLanguage: "uk", dubbed: true },
    presentation: { printType: "3D", format: "4DX", screenFeatures: ["4DX"] },
    providerRef: { provider: "cinema-city", cinema: "arkadia", screeningId: "502" },
  });
  assert.equal(soldOut.link, undefined);
  assert.equal(blocked.link, undefined);
  assert.deepEqual(blocked.presentation, { printType: "2D", soundType: "ATMOS" });

  const normalized = normalizeShow(shows[0], "Cinema City Arkadia", "cinema-city-arkadia");
  assert.equal(normalized.screenings.length, 4);
  assert.equal(normalized.screenings.find((screening) => screening.providerRef?.screeningId === "503")?.link, undefined);
  assert.equal(normalized.screenings.find((screening) => screening.providerRef?.screeningId === "504")?.link, undefined);
});

test("rejects unsuccessful and malformed Cinema City responses", async () => {
  const failedClient = createCinemaCityClient(async () => jsonResponse({}, { status: 503 }));
  await assert.rejects(failedClient.getShowings("1074", "2026-08-13"), /HTTP 503/);

  await assert.rejects(
    parseCinemaCityCinema("arkadia", "2026-08-13", {
      client: { getShowings: async () => ({ body: { films: null, events: [] } }) },
    }),
    /invalid schedule response/,
  );
});
