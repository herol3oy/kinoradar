import assert from "node:assert/strict";
import test from "node:test";

import { buildPopularScreenings } from "../src/lib/popular-screenings.ts";

function film(id, title, originalTitle = title, year = 2026) {
  return { id, title, originalTitle, year, subType: "film_cinema", posterUrl: null };
}

function show(title, cinema, times, source = "kinoteka") {
  return {
    title,
    canonicalTitle: title,
    times,
    screenings: times.map((time) => ({ time })),
    cinema,
    source,
  };
}

test("keeps Filmweb popularity order for matched films", () => {
  const items = buildPopularScreenings(
    [film(1, "Alfa"), film(2, "Beta")],
    [show("Beta", "Kinoteka", ["20:00"]), show("Alfa", "Muranów", ["18:00"])],
    600,
  );

  assert.deepEqual(items.map((item) => item.filmwebId), [1, 2]);
  assert.deepEqual(items.map((item) => item.cinema), ["Muranów", "Kinoteka"]);
});

test("skips films without a Warsaw screening", () => {
  const items = buildPopularScreenings(
    [film(1, "Brak seansów"), film(2, "Alfa")],
    [show("Alfa", "Kinoteka", ["18:00"])],
    600,
  );

  assert.deepEqual(items.map((item) => item.displayTitle), ["Alfa"]);
});

test("matches through the original title when the localized title differs", () => {
  const items = buildPopularScreenings(
    [film(1, "Backrooms. Bez wyjścia", "Backrooms")],
    [show("Backrooms", "Kinoteka", ["18:00"])],
    600,
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Backrooms");
  assert.equal(items[0].displayTitle, "Backrooms. Bez wyjścia");
});

test("matches titles regardless of accents and case", () => {
  const items = buildPopularScreenings(
    [film(1, "Związek")],
    [show("ZWIAZEK", "Muranów", ["18:00"])],
    600,
  );

  assert.equal(items.length, 1);
});

test("prefers the earliest upcoming screening and falls back to the earliest of the day", () => {
  const shows = [show("Alfa", "Kinoteka", ["10:00", "18:00", "21:30"])];

  const upcoming = buildPopularScreenings([film(1, "Alfa")], shows, 660);
  assert.equal(upcoming[0].screening.time, "18:00");
  assert.equal(upcoming[0].upcoming, true);

  const past = buildPopularScreenings([film(1, "Alfa")], shows, 1400);
  assert.equal(past[0].screening.time, "10:00");
  assert.equal(past[0].upcoming, false);
});

test("caps the number of returned items", () => {
  const films = [film(1, "Alfa"), film(2, "Beta"), film(3, "Gamma")];
  const shows = films.map((entry, index) => show(entry.title, `Kino ${index}`, ["18:00"]));

  assert.equal(buildPopularScreenings(films, shows, 600, 2).length, 2);
});
