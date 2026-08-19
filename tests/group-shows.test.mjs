import assert from "node:assert/strict";
import test from "node:test";

import { groupShows, normalizeTitle } from "../src/lib/group-shows.ts";

function show(title, cinema, source = "kinoteka", times = ["18:00"]) {
  return {
    title,
    canonicalTitle: title,
    times,
    screenings: times.map((time) => ({ time })),
    cinema,
    source,
  };
}

test("groups by cinema in cinema view and keeps first-seen order", () => {
  const groups = groupShows(
    [
      show("Alfa", "Kinoteka", "kinoteka"),
      show("Beta", "Muranów", "kinomuranow"),
      show("Gamma", "Kinoteka", "kinoteka"),
    ],
    "cinema",
    "pl",
  );

  assert.deepEqual(groups.map((group) => group.heading), ["Kinoteka", "Muranów"]);
  assert.deepEqual(groups.map((group) => group.filmCount), [2, 1]);
  assert.deepEqual(groups.map((group) => group.source), ["kinoteka", "kinomuranow"]);
});

test("groups by normalized film title in film view", () => {
  const groups = groupShows(
    [
      show("Związek", "Kinoteka"),
      show("ZWIAZEK", "Muranów"),
      show("  związek  ", "Atlantic"),
    ],
    "film",
    "pl",
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].filmCount, 3);
  assert.equal(groups[0].heading, "Związek");
  assert.deepEqual(groups[0].shows.map((entry) => entry.cinema), ["Kinoteka", "Muranów", "Atlantic"]);
});

test("normalizeTitle strips diacritics, case and repeated whitespace", () => {
  assert.equal(normalizeTitle("  Zwiąż   SIĘ  "), "zwiaz sie");
});

test("anchor ids are slugified, stable and unique", () => {
  const shows = [show("Alfa", "Kino Muranów"), show("Beta", "Kinoteka")];

  const first = groupShows(shows, "cinema", "pl");
  const second = groupShows(shows, "cinema", "pl");

  assert.deepEqual(first.map((group) => group.anchorId), ["group-kino-muranow", "group-kinoteka"]);
  assert.deepEqual(first.map((group) => group.anchorId), second.map((group) => group.anchorId));
});

test("disambiguates anchor ids that slugify to the same value", () => {
  const groups = groupShows(
    [show("Alfa", "Kino/Teka"), show("Beta", "Kino Teka")],
    "cinema",
    "pl",
  );

  assert.deepEqual(groups.map((group) => group.anchorId), ["group-kino-teka", "group-kino-teka-2"]);
});

test("falls back to a usable anchor id when the key has no alphanumerics", () => {
  const groups = groupShows([show("Alfa", "***")], "cinema", "pl");

  assert.equal(groups[0].anchorId, "group-group");
});

test("returns an empty array for no shows", () => {
  assert.deepEqual(groupShows([], "cinema", "pl"), []);
});
