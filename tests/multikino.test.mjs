import assert from "node:assert/strict";
import test from "node:test";

import { MULTIKINO_AUTH_URL, MULTIKINO_CINEMAS } from "../src/lib/multikino.ts";
import { normalizeShow } from "../src/lib/normalize.ts";
import { parseMultikinoCinema } from "../src/lib/parsers/multikino.ts";
import { createMultikinoClient } from "../src/server/multikino.ts";

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function authResponse(token = "access-one") {
  const headers = new Headers();
  headers.append("Set-Cookie", `microservicesToken=${token}; Path=/; Secure; HttpOnly`);
  headers.append("Set-Cookie", "microservicesRefreshToken=refresh-one; Path=/; Secure; HttpOnly");
  headers.append("Set-Cookie", "accessTokenExpirationTime=123; Path=/; Secure");
  headers.append("Set-Cookie", "refreshTokenExpirationTime=456; Path=/; Secure");
  headers.append("Set-Cookie", "trackingCookie=must-not-be-forwarded; Path=/");
  return jsonResponse({ result: { accessToken: null }, responseCode: 0, errorMessage: null }, { headers });
}

test("shares one anonymous Multikino session across all five cinema requests", async () => {
  let authRequests = 0;
  const scheduleRequests = [];
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.toString() === MULTIKINO_AUTH_URL) {
      authRequests += 1;
      assert.equal(init.method, "POST");
      return authResponse();
    }

    const cinemaId = url.pathname.match(/\/cinemas\/(\d+)\/films$/)?.[1];
    scheduleRequests.push({
      cinemaId,
      cookie: new Headers(init.headers).get("Cookie"),
      date: url.searchParams.get("showingDate"),
      minEmbargoLevel: url.searchParams.get("minEmbargoLevel"),
      includesSession: url.searchParams.get("includesSession"),
      includeSessionAttributes: url.searchParams.get("includeSessionAttributes"),
    });
    return jsonResponse({ result: [], responseCode: 0, errorMessage: null });
  };

  const client = createMultikinoClient(fetcher);
  await Promise.all(MULTIKINO_CINEMAS.map((cinema) => client.getShowings(cinema.cinemaId, "2026-08-13")));

  assert.equal(authRequests, 1);
  assert.equal(scheduleRequests.length, 5);
  assert.deepEqual(
    scheduleRequests.map((request) => request.cinemaId).sort(),
    MULTIKINO_CINEMAS.map((cinema) => cinema.cinemaId).sort(),
  );
  scheduleRequests.forEach((request) => {
    assert.equal(request.date, "2026-08-13");
    assert.equal(request.minEmbargoLevel, "3");
    assert.equal(request.includesSession, "true");
    assert.equal(request.includeSessionAttributes, "true");
    assert.equal(
      request.cookie,
      "microservicesToken=access-one; microservicesRefreshToken=refresh-one; accessTokenExpirationTime=123; refreshTokenExpirationTime=456",
    );
    assert.doesNotMatch(request.cookie, /trackingCookie/);
  });
});

test("maps Multikino films, formats, languages, and explicit ticket availability", async () => {
  const payload = {
    result: [
      {
        filmId: "FILM1",
        filmTitle: "A Complete Unknown",
        filmUrl: "https://www.multikino.pl/filmy/a-complete-unknown",
        posterImageSrc: "https://www.multikino.pl/-/media/posters/film1.jpg",
        showingGroups: [
          {
            date: "2026-08-13T00:00:00",
            sessions: [
              {
                sessionId: "101",
                bookingUrl: "/rezerwacja-biletow/podsumowanie/0040/FILM1/101",
                startTime: "2026-08-13T18:00:00",
                isSoldOut: false,
                isBookingAvailable: true,
                attributes: [
                  { attributeType: "Language", value: "NAPISY", name: "Napisy angielskie" },
                  { attributeType: "Session", value: "3D" },
                  { attributeType: "Session", value: "ATMOS" },
                ],
              },
              {
                sessionId: "102",
                bookingUrl: "/rezerwacja-biletow/podsumowanie/0040/FILM1/102",
                showTimeWithTimeZone: "2026-08-13T18:00:00+02:00",
                isSoldOut: false,
                isBookingAvailable: true,
                attributes: [
                  { attributeType: "Language", value: "DUBBING" },
                  { attributeType: "Session", value: "2D" },
                ],
              },
              {
                sessionId: "103",
                bookingUrl: "/rezerwacja-biletow/podsumowanie/0040/FILM1/103",
                startTime: "2026-08-13T20:15:00",
                isSoldOut: true,
                isBookingAvailable: true,
                attributes: [
                  { attributeType: "Language", value: "DUBBING" },
                  { attributeType: "Language", value: "ua" },
                ],
              },
              {
                sessionId: "104",
                bookingUrl: "https://tickets.example/unsafe",
                startTime: "2026-08-13T21:30:00",
                isSoldOut: false,
                isBookingAvailable: true,
                attributes: [{ attributeType: "Language", value: "NAPISY" }],
              },
              {
                sessionId: "105",
                bookingUrl: "/rezerwacja-biletow/podsumowanie/0040/FILM1/105",
                startTime: "2026-08-14T10:00:00",
                isSoldOut: false,
                isBookingAvailable: true,
              },
              { sessionId: "not-numeric", startTime: "2026-08-13T22:00:00" },
              { sessionId: "101", startTime: "2026-08-13T23:00:00" },
            ],
          },
        ],
      },
      { filmId: "BROKEN", filmTitle: "Broken record", showingGroups: "invalid" },
      null,
    ],
    responseCode: 0,
    errorMessage: null,
  };
  const client = {
    async getShowings(cinemaId, day) {
      assert.equal(cinemaId, "0040");
      assert.equal(day, "2026-08-13");
      return payload;
    },
  };

  const shows = await parseMultikinoCinema("mlociny", "2026-08-13", { client });
  assert.equal(shows.length, 1);
  assert.equal(shows[0].title, "A Complete Unknown");
  assert.equal(shows[0].link, "https://www.multikino.pl/filmy/a-complete-unknown");
  assert.equal(shows[0].poster, "https://www.multikino.pl/-/media/posters/film1.jpg");
  assert.equal(shows[0].screenings.length, 4);

  const [english3d, dubbed2d, ukrainianSoldOut, unsafeBooking] = shows[0].screenings;
  assert.deepEqual(english3d, {
    time: "18:00",
    link: "https://www.multikino.pl/rezerwacja-biletow/podsumowanie/0040/FILM1/101",
    language: { subtitled: true, subtitleLanguages: ["en"] },
    presentation: { printType: "3D", soundType: "ATMOS" },
    providerRef: { provider: "multikino", cinema: "mlociny", screeningId: "101" },
  });
  assert.deepEqual(dubbed2d, {
    time: "18:00",
    link: "https://www.multikino.pl/rezerwacja-biletow/podsumowanie/0040/FILM1/102",
    language: { dubbed: true },
    presentation: { printType: "2D" },
    providerRef: { provider: "multikino", cinema: "mlociny", screeningId: "102" },
  });
  assert.deepEqual(ukrainianSoldOut, {
    time: "20:15",
    link: undefined,
    language: { dubbed: true, audioLanguage: "ua" },
    presentation: undefined,
    providerRef: { provider: "multikino", cinema: "mlociny", screeningId: "103" },
  });
  assert.equal(unsafeBooking.link, undefined);

  const normalized = normalizeShow(shows[0], "Multikino Młociny", "multikino-mlociny");
  assert.equal(normalized.link, shows[0].link);
  assert.equal(normalized.screenings.length, 4);
  assert.equal(normalized.screenings.find((screening) => screening.providerRef?.screeningId === "103")?.link, undefined);
  assert.equal(normalized.screenings.find((screening) => screening.providerRef?.screeningId === "104")?.link, undefined);
});

test("rejects invalid Multikino authentication and schedule responses", async () => {
  const invalidAuthClient = createMultikinoClient(async () => jsonResponse(
    { result: {}, responseCode: 0 },
    { headers: { "Set-Cookie": "microservicesToken=only-one-cookie; Path=/" } },
  ));
  await assert.rejects(
    invalidAuthClient.getShowings("0052", "2026-08-13"),
    /did not set microservicesRefreshToken/,
  );

  await assert.rejects(
    parseMultikinoCinema("reduta", "2026-08-13", {
      client: { getShowings: async () => ({ responseCode: 2, result: null }) },
    }),
    /invalid schedule response/,
  );
});

test("refreshes the anonymous Multikino session once after an unauthorized response", async () => {
  let authRequests = 0;
  let scheduleRequests = 0;
  const fetcher = async (input) => {
    if (String(input) === MULTIKINO_AUTH_URL) {
      authRequests += 1;
      return authResponse(`access-${authRequests}`);
    }
    scheduleRequests += 1;
    return scheduleRequests === 1
      ? jsonResponse({}, { status: 401 })
      : jsonResponse({ result: [], responseCode: 0 });
  };

  const client = createMultikinoClient(fetcher);
  assert.deepEqual(await client.getShowings("0052", "2026-08-13"), { result: [], responseCode: 0 });
  assert.equal(authRequests, 2);
  assert.equal(scheduleRequests, 2);
});
