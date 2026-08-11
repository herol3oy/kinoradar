import assert from "node:assert/strict";
import test from "node:test";

import { parseKinoteka } from "../src/lib/parsers/kinoteka.ts";
import { normalizeShow } from "../src/lib/normalize.ts";
import { favoriteKey } from "../src/lib/favorites.ts";
import { screeningIdentity } from "../src/lib/screening-language.ts";
import { getKinotekaLiveScreening, isKinotekaScreeningId } from "../src/server/kinoteka.ts";

const SCREENING_ID = "ffa0c609-4520-40b5-be23-33da8aeb3a3c";
const SECOND_SCREENING_ID = "5fa0c609-4520-40b5-be23-33da8aeb3a3d";
const THIRD_SCREENING_ID = "4fa0c609-4520-40b5-be23-33da8aeb3a3e";
const MOVIE_ID = "dfaaf102-3d65-4a4f-806f-07a4d88832a5";
const SECOND_MOVIE_ID = "cfaaf102-3d65-4a4f-806f-07a4d88832a6";

test("maps Kinoteka REST screenings and fetches each movie once", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith("/screening")) {
      return Response.json([
        {
          id: SCREENING_ID,
          movieId: MOVIE_ID,
          screeningTimeFrom: "2026-08-11T15:30:00+02:00",
          language: "EN",
          subtitles: "PL",
          subtitles2: "",
          speakingType: "ORG",
          printType: "2D",
          soundType: "5.1",
          format: "Flat",
          screenFeatures: ["STANDARD"],
        },
        {
          id: SECOND_SCREENING_ID,
          movieId: MOVIE_ID,
          screeningTimeFrom: "2026-08-11T19:45:00+02:00",
          language: "EN",
          subtitles: "PL",
          speakingType: "ORG",
        },
        {
          id: THIRD_SCREENING_ID,
          movieId: SECOND_MOVIE_ID,
          screeningTimeFrom: "2026-08-11T21:15:00+02:00",
          language: "EN",
          subtitles: "PL",
          speakingType: "ORG",
        },
      ]);
    }
    if (url.pathname.endsWith(`/movie/${MOVIE_ID}`) || url.pathname.endsWith(`/movie/${SECOND_MOVIE_ID}`)) {
      return Response.json({
        id: url.pathname.endsWith(MOVIE_ID) ? MOVIE_ID : SECOND_MOVIE_ID,
        title: "Spider-Man: Całkiem nowy dzień [napisy PL]",
        shortTitle: "Spider-Man: Całkiem nowy dzień",
        posters: ["https://medstore.kinoteka.pl/poster.jpg"],
      });
    }
    return new Response("not found", { status: 404 });
  };

  const result = await parseKinoteka("2026-08-11");
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Spider-Man: Całkiem nowy dzień");
  assert.equal(result[0].poster, "https://medstore.kinoteka.pl/poster.jpg");
  assert.deepEqual(result[0].screenings.map((screening) => screening.time), ["15:30", "19:45", "21:15"]);
  assert.deepEqual(result[0].screenings[0].subtitleLanguages, ["pl"]);
  assert.equal(result[0].screenings[0].audioLanguage, "en");
  assert.equal(result[0].screenings[0].dubbed, false);
  assert.equal(result[0].screenings[0].providerRef.screeningId, SCREENING_ID);
  assert.deepEqual(result[0].screenings[0].presentation, {
    printType: "2D",
    soundType: "5.1",
    format: "Flat",
    screenFeatures: ["STANDARD"],
  });
  assert.match(result[0].screenings[0].link, new RegExp(SCREENING_ID));

  const scheduleRequest = requests.find((url) => url.pathname.endsWith("/screening"));
  assert.equal(scheduleRequest.searchParams.get("dateTimeFrom"), "2026-08-11T00:00:00.000");
  assert.equal(scheduleRequest.searchParams.get("dateTimeTo"), "2026-08-11T23:59:59.999");
  assert.equal(requests.filter((url) => url.pathname.includes("/movie/")).length, 2);
});

test("keeps Kinoteka partial results when one movie request fails", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  t.mock.method(console, "error", () => {});

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/screening")) {
      return Response.json([
        { id: SCREENING_ID, movieId: MOVIE_ID, screeningTimeFrom: "2026-08-11T15:30:00+02:00" },
        { id: SECOND_SCREENING_ID, movieId: SECOND_MOVIE_ID, screeningTimeFrom: "2026-08-11T18:00:00+02:00" },
      ]);
    }
    if (url.pathname.endsWith(`/movie/${MOVIE_ID}`)) return Response.json({ shortTitle: "Available film", posters: [] });
    return new Response("upstream failed", { status: 503 });
  };

  const result = await parseKinoteka("2026-08-11");
  assert.deepEqual(result.map((show) => show.title), ["Available film"]);
});

test("loads assigned-seat prices using an available standard seat", async () => {
  const requests = [];
  const fetcher = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith(`/screening/${SCREENING_ID}`)) {
      return Response.json({ audience: 3, maxOccupancy: 10, generalAdmission: false });
    }
    if (url.pathname.endsWith("/screen")) {
      return Response.json([{ seats: [
        { id: "occupied-seat", kind: "0", symbol: "1", wheelchairSeat: false },
        { id: "available-seat", kind: "0", symbol: "2", wheelchairSeat: false },
      ], blockedList: [] }]);
    }
    if (url.pathname.endsWith("/occupancy")) {
      return Response.json({ occupiedSeats: ["occupied-seat"], seatsLeft: 7, lockGroups: [] });
    }
    if (url.pathname.endsWith("/tickets")) {
      return Response.json([
        { id: "normal", name: "Normalny", price: 24, priceWithMandatoryExtraFees: 26 },
        { id: "student", name: "Ulgowy", price: 20, priceWithMandatoryExtraFees: 22 },
      ]);
    }
    return new Response("not found", { status: 404 });
  };

  const result = await getKinotekaLiveScreening(SCREENING_ID, fetcher);
  assert.equal(result.booked, 3);
  assert.equal(result.capacity, 10);
  assert.equal(result.fromPrice, 22);
  assert.equal(result.soldOut, false);
  assert.deepEqual(result.offers.map(({ name, price }) => ({ name, price })), [
    { name: "Normalny", price: 26 },
    { name: "Ulgowy", price: 22 },
  ]);
  assert.equal(requests.find((url) => url.pathname.endsWith("/tickets")).searchParams.get("seatIds"), "available-seat");
  assert.equal(requests.length, 4);
});

test("uses the general-admission price endpoint without loading a seat map", async () => {
  const requests = [];
  const fetcher = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith(`/screening/${SCREENING_ID}`)) {
      return Response.json({ audience: 40, maxOccupancy: 100, generalAdmission: true });
    }
    if (url.pathname.endsWith("/ga/tickets")) {
      return Response.json([{ id: "ga", name: "Normalny", price: 30, priceWithMandatoryExtraFees: 30 }]);
    }
    return new Response("not found", { status: 404 });
  };

  const result = await getKinotekaLiveScreening(SCREENING_ID, fetcher);
  assert.equal(result.fromPrice, 30);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].pathname.endsWith("/ga/tickets"));
});

test("provider identity distinguishes screenings without changing favorite keys", () => {
  const first = normalizeShow({
    title: "Film",
    screenings: [
      { time: "18:00", providerRef: { provider: "kinoteka", screeningId: SCREENING_ID } },
      { time: "18:00", providerRef: { provider: "kinoteka", screeningId: SECOND_SCREENING_ID } },
    ],
  }, "Kinoteka", "kinoteka");

  assert.equal(first.screenings.length, 2);
  assert.notEqual(screeningIdentity(first.screenings[0]), screeningIdentity(first.screenings[1]));
  assert.equal(
    favoriteKey("Film", "2026-08-11", "18:00", "Kinoteka", first.screenings[0], "kinoteka"),
    favoriteKey("Film", "2026-08-11", "18:00", "Kinoteka", first.screenings[1], "kinoteka"),
  );
  assert.equal(isKinotekaScreeningId(SCREENING_ID), true);
  assert.equal(isKinotekaScreeningId("../../order"), false);
});
