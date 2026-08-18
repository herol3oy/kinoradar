import assert from "node:assert/strict";
import test from "node:test";

import {
  FILMWEB_POPULAR_SCHEMA_VERSION,
  filmwebPosterUrl,
  isPopularFilmsCache,
  isPopularFilmsCacheStale,
  titleMatchKeys,
} from "../src/lib/filmweb.ts";
import { fetchPopularFilms } from "../src/server/filmweb.ts";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetcherFor(popular, details) {
  return async (url) => {
    const target = String(url);
    if (target.endsWith("/film/popular/in-cinema")) return jsonResponse(popular);
    const id = Number(target.match(/\/title\/(\d+)\/info$/)?.[1]);
    const detail = details[id];
    if (!detail) return jsonResponse({ error: "not found" }, 500);
    return jsonResponse(detail);
  };
}

function film(overrides = {}) {
  return {
    id: 10099388,
    title: "Backrooms. Bez wyjścia",
    originalTitle: "Backrooms",
    year: 2026,
    subType: "film_cinema",
    posterUrl: null,
    ...overrides,
  };
}

function cache(overrides = {}) {
  return {
    schemaVersion: FILMWEB_POPULAR_SCHEMA_VERSION,
    updatedAt: "2026-08-09T10:00:00.000Z",
    films: [film()],
    ...overrides,
  };
}

test("builds a Filmweb poster URL from the size placeholder", () => {
  assert.equal(
    filmwebPosterUrl("/93/88/10099388/8242946.$.jpg"),
    "https://fwcdn.pl/fpo/93/88/10099388/8242946.3.jpg",
  );
});

test("returns null for missing or malformed poster paths", () => {
  assert.equal(filmwebPosterUrl(undefined), null);
  assert.equal(filmwebPosterUrl(""), null);
  assert.equal(filmwebPosterUrl("93/88/10099388/8242946.$.jpg"), null);
  assert.equal(filmwebPosterUrl("/93/88/10099388/8242946.jpg"), null);
});

test("collects unique normalized title keys for matching", () => {
  assert.deepEqual(titleMatchKeys(film({ title: "Związek", originalTitle: "Zwiazek" })), ["zwiazek"]);
  assert.deepEqual(titleMatchKeys(film()), ["backrooms. bez wyjscia", "backrooms"]);
});

test("accepts a valid popular films cache and rejects mismatched schema versions", () => {
  assert.equal(isPopularFilmsCache(cache()), true);
  assert.equal(isPopularFilmsCache(cache({ schemaVersion: FILMWEB_POPULAR_SCHEMA_VERSION + 1 })), false);
  assert.equal(isPopularFilmsCache(cache({ films: [{ id: 0 }] })), false);
  assert.equal(isPopularFilmsCache(null), false);
});

test("marks the popular films cache stale after four hours", () => {
  const fresh = cache();
  assert.equal(isPopularFilmsCacheStale(fresh, new Date("2026-08-09T12:00:00.000Z")), false);
  assert.equal(isPopularFilmsCacheStale(fresh, new Date("2026-08-09T14:00:00.000Z")), true);
});

test("fetches popular film metadata in popularity order", async () => {
  const films = await fetchPopularFilms(fetcherFor([3, 1, 2], {
    1: { title: "One", originalTitle: "One", year: 2025, subType: "film_cinema", posterPath: "/a/1.$.jpg" },
    2: { title: "Two", originalTitle: "Two", year: 2026, subType: "film_cinema", posterPath: null },
    3: { title: "Three", originalTitle: "Three", year: null, subType: "film_cinema" },
  }));

  assert.deepEqual(films.map((entry) => entry.id), [3, 1, 2]);
  assert.equal(films[1].posterUrl, "https://fwcdn.pl/fpo/a/1.3.jpg");
  assert.equal(films[0].year, null);
});

test("skips films whose detail request fails", async () => {
  const films = await fetchPopularFilms(fetcherFor([1, 2], {
    1: { title: "One", originalTitle: "One", year: 2025, subType: "film_cinema" },
  }));

  assert.deepEqual(films.map((entry) => entry.title), ["One"]);
});

test("throws when the popular payload is not an array", async () => {
  await assert.rejects(
    fetchPopularFilms(fetcherFor({ films: [] }, {})),
    /Invalid Filmweb popular response/,
  );
});
