import assert from "node:assert/strict";
import test from "node:test";

import {
  isEnglishFriendly,
  parseScreeningTitle,
  screeningFingerprint,
} from "../src/lib/screening-language.ts";
import {
  mergeShowsForDisplay,
  normalizeShow,
} from "../src/lib/normalize.ts";
import {
  decodeSharedFavorites,
  encodeSharedFavorites,
  favoriteFilmKey,
  sanitizeFavorites,
} from "../src/lib/favorites.ts";
import {
  getCachedSchedule,
  SCHEDULE_SCHEMA_VERSION,
} from "../src/server/kv.ts";

test("extracts explicit subtitle and dubbing suffixes", () => {
  assert.deepEqual(parseScreeningTitle("Wielki Łuk [napisy PL + EN]"), {
    canonicalTitle: "Wielki Łuk",
    language: { subtitled: true, subtitleLanguages: ["en", "pl"] },
  });
  assert.deepEqual(parseScreeningTitle("Toy Story 5 [dubbing PL]"), {
    canonicalTitle: "Toy Story 5",
    language: { dubbed: true, audioLanguage: "pl" },
  });
});

test("keeps generic language and unrelated title qualifiers conservative", () => {
  assert.deepEqual(parseScreeningTitle("Odyseja - napisy"), {
    canonicalTitle: "Odyseja",
    language: { subtitled: true },
  });
  assert.deepEqual(parseScreeningTitle("Spider-Man (dolby atmos)"), {
    canonicalTitle: "Spider-Man (dolby atmos)",
    language: {},
  });
  assert.deepEqual(parseScreeningTitle("Homo sapiens? (Rejs)"), {
    canonicalTitle: "Homo sapiens? (Rejs)",
    language: {},
  });
});

test("normalizes legacy times additively and preserves source fields", () => {
  const show = normalizeShow({
    title: "Kandydaci Śmierci [napisy EN]",
    times: ["12:00", "20:00"],
    link: "https://example.com/tickets",
  }, "Kinoteka", "kinoteka");

  assert.equal(show.title, "Kandydaci Śmierci [napisy EN]");
  assert.equal(show.canonicalTitle, "Kandydaci Śmierci");
  assert.deepEqual(show.times, ["12:00", "20:00"]);
  assert.equal(show.link, "https://example.com/tickets");
  assert.deepEqual(show.screenings[0], {
    time: "12:00",
    subtitled: true,
    subtitleLanguages: ["en"],
    link: "https://example.com/tickets",
  });
});

test("structured screening language overrides title-derived fallback", () => {
  const show = normalizeShow({
    title: "Example [dubbing PL]",
    link: "https://example.com/movie",
    screenings: [{
      time: "18:30",
      audioLanguage: "EN",
      subtitleLanguages: ["PL"],
      subtitled: true,
      dubbed: false,
    }],
  }, "Kinogram", "kinogram");

  assert.deepEqual(show.screenings[0], {
    time: "18:30",
    audioLanguage: "en",
    subtitleLanguages: ["pl"],
    subtitled: true,
    dubbed: false,
    link: "https://example.com/movie",
  });
});

test("merges display variants while preserving distinct same-time screenings", () => {
  const dubbed = normalizeShow({ title: "Spider-Man - dubbing", times: ["12:15"], link: "https://example.com/dub" }, "Wisła", "kinowisla");
  const subtitled = normalizeShow({ title: "Spider-Man [napisy EN]", times: ["12:15"], link: "https://example.com/sub" }, "Wisła", "kinowisla");
  const [merged] = mergeShowsForDisplay([dubbed, subtitled]);

  assert.equal(merged.title, "Spider-Man");
  assert.equal(merged.canonicalTitle, "Spider-Man");
  assert.deepEqual(merged.times, ["12:15"]);
  assert.equal(merged.screenings.length, 2);
  assert.deepEqual(new Set(merged.screenings.map((screening) => screening.link)), new Set([
    "https://example.com/dub",
    "https://example.com/sub",
  ]));
});

test("English-friendly requires verified English audio or subtitles", () => {
  assert.equal(isEnglishFriendly({ time: "12:00", audioLanguage: "en" }), true);
  assert.equal(isEnglishFriendly({ time: "12:00", subtitleLanguages: ["pl", "en"], subtitled: true }), true);
  assert.equal(isEnglishFriendly({ time: "12:00", audioLanguage: "pl", dubbed: true }), false);
  assert.equal(isEnglishFriendly({ time: "12:00", subtitled: true }), false);
  assert.notEqual(
    screeningFingerprint({ time: "12:00", audioLanguage: "pl", dubbed: true }),
    screeningFingerprint({ time: "12:00", subtitleLanguages: ["en"], subtitled: true }),
  );
});

test("v3 favorites preserve screening language and reject v2 shared lists", () => {
  const [favorite] = sanitizeFavorites([{
    title: "Wielki Łuk",
    date: "2026-08-09",
    time: "17:45",
    cinema: "Kinoteka",
    source: "kinoteka",
    subtitleLanguages: ["EN", "PL"],
    subtitled: true,
    addedAt: "2026-08-09T12:00:00.000Z",
  }]);
  const decoded = decodeSharedFavorites(encodeSharedFavorites([favorite]));

  assert.equal(decoded.length, 1);
  assert.deepEqual(decoded[0].subtitleLanguages, ["en", "pl"]);
  assert.equal(favoriteFilmKey(decoded[0]), favoriteFilmKey(favorite));

  const oldPayload = Buffer.from(JSON.stringify({ v: 2, films: [] })).toString("base64url");
  assert.deepEqual(decodeSharedFavorites(oldPayload), []);
});

test("removes persisted and shared Cinema City favorites", () => {
  const cinemaCityFavorite = {
    title: "Odyseja",
    date: "2026-08-14",
    time: "18:00",
    cinema: "Cinema City Arkadia",
    source: "cinema-city-arkadia",
    addedAt: "2026-08-14T12:00:00.000Z",
  };
  assert.deepEqual(sanitizeFavorites([cinemaCityFavorite]), []);

  const encoded = Buffer.from(JSON.stringify({
    v: 3,
    films: [{ t: "Odyseja", d: "2026-08-14", h: "18:00", c: "Cinema City Arkadia", o: "cinema-city-arkadia" }],
  })).toString("base64url");
  assert.deepEqual(decodeSharedFavorites(encoded), []);
});

test("invalidates pre-language cache payloads", async () => {
  const legacyKv = { get: async () => ({ shows: [], updatedAt: null, failedCinemas: [] }) };
  const currentKv = { get: async () => ({ schemaVersion: SCHEDULE_SCHEMA_VERSION, shows: [], updatedAt: null, failedCinemas: [] }) };

  assert.equal(await getCachedSchedule(legacyKv, "2026-08-09"), null);
  assert.equal((await getCachedSchedule(currentKv, "2026-08-09")).schemaVersion, SCHEDULE_SCHEMA_VERSION);
});
