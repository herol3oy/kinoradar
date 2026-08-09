import assert from "node:assert/strict";
import test from "node:test";

import {
  RELEASE_CATALOG_SCHEMA_VERSION,
  isReleaseCatalogStale,
  paginateReleaseCatalog,
} from "../src/lib/releases.ts";
import {
  fetchReleaseCatalog,
  getCachedReleaseCatalog,
} from "../src/server/releases.ts";

function release(id, date, title, genres = []) {
  return {
    id,
    title,
    originalTitle: title,
    overview: "",
    releaseDate: date,
    year: Number(date.slice(0, 4)),
    posterUrl: null,
    genres,
    detailsUrl: `https://www.themoviedb.org/movie/${id}`,
  };
}

function catalog(overrides = {}) {
  return {
    schemaVersion: RELEASE_CATALOG_SCHEMA_VERSION,
    locale: "pl",
    generatedFor: "2026-08-09",
    updatedAt: "2026-08-09T10:00:00.000Z",
    genres: [{ id: 18, name: "Dramat" }, { id: 35, name: "Komedia" }],
    releases: [],
    ...overrides,
  };
}

test("filters releases before paginating complete date groups", () => {
  const drama = { id: 18, name: "Dramat" };
  const releases = Array.from({ length: 10 }, (_, index) => {
    const day = String(9 + index).padStart(2, "0");
    return release(index + 1, `2026-08-${day}`, index === 8 ? "Łódź nocą" : `Film ${index}`, [drama]);
  });
  releases.push(release(20, "2026-08-01", "Past film", [drama]));
  const source = catalog({ releases });

  const first = paginateReleaseCatalog(source, "2026-08-09");
  assert.equal(first.groups.length, 8);
  assert.equal(first.totalGroups, 10);
  assert.equal(first.totalReleases, 10);
  assert.equal(first.nextCursor, "2026-08-16");

  const second = paginateReleaseCatalog(source, "2026-08-09", { cursor: first.nextCursor });
  assert.deepEqual(second.groups.map((group) => group.date), ["2026-08-17", "2026-08-18"]);
  assert.equal(second.nextCursor, null);

  const searched = paginateReleaseCatalog(source, "2026-08-09", { query: "lodz" });
  assert.equal(searched.totalReleases, 1);
  assert.equal(searched.groups[0].releases[0].title, "Łódź nocą");
});

test("filters by genre and marks catalogs stale after 24 hours", () => {
  const source = catalog({
    releases: [
      release(1, "2026-08-10", "Drama", [{ id: 18, name: "Dramat" }]),
      release(2, "2026-08-10", "Comedy", [{ id: 35, name: "Komedia" }]),
    ],
  });

  const page = paginateReleaseCatalog(source, "2026-08-09", { genreId: 35 });
  assert.deepEqual(page.groups[0].releases.map((item) => item.title), ["Comedy"]);
  assert.equal(isReleaseCatalogStale(source, new Date("2026-08-10T09:59:59.000Z")), false);
  assert.equal(isReleaseCatalogStale(source, new Date("2026-08-10T10:00:00.000Z")), true);
});

test("rejects release caches from older schemas or the wrong locale", async () => {
  const current = catalog();
  assert.equal(await getCachedReleaseCatalog({ get: async () => current }, "pl"), current);
  assert.equal(await getCachedReleaseCatalog({ get: async () => ({ ...current, schemaVersion: 0 }) }, "pl"), null);
  assert.equal(await getCachedReleaseCatalog({ get: async () => ({ ...current, locale: "en" }) }, "pl"), null);
});

test("fetches every reported TMDB page and maps localized release data", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, init });

    if (url.pathname.endsWith("/genre/movie/list")) {
      return Response.json({ genres: [{ id: 18, name: "Dramat" }] });
    }

    const page = Number(url.searchParams.get("page"));
    return Response.json({
      page,
      total_pages: 2,
      results: page === 1 ? [{
        id: 7,
        title: "Polski tytuł",
        original_title: "Original title",
        overview: "Opis filmu",
        release_date: "2026-08-21",
        poster_path: "/poster.jpg",
        genre_ids: [18],
      }, {
        id: 8,
        title: "Old",
        original_title: "Old",
        overview: "",
        release_date: "2026-08-01",
        poster_path: null,
        genre_ids: [],
      }] : [{
        id: 9,
        title: "Drugi film",
        original_title: "Second film",
        overview: "",
        release_date: "2026-09-04",
        poster_path: null,
        genre_ids: [18],
      }],
    });
  };

  const result = await fetchReleaseCatalog("test-token", "pl", "2026-08-09");
  assert.deepEqual(result.releases.map((item) => item.id), [7, 9]);
  assert.equal(result.releases[0].posterUrl, "https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.deepEqual(result.releases[0].genres, [{ id: 18, name: "Dramat" }]);
  assert.equal(requests.length, 3);

  const discoverRequests = requests.filter(({ url }) => url.pathname.endsWith("/discover/movie"));
  assert.deepEqual(discoverRequests.map(({ url }) => url.searchParams.get("page")), ["1", "2"]);
  assert.ok(discoverRequests.every(({ url }) => url.searchParams.get("region") === "PL"));
  assert.ok(discoverRequests.every(({ url }) => url.searchParams.get("with_release_type") === "2|3"));
  assert.ok(discoverRequests.every(({ url }) => url.searchParams.get("release_date.gte") === "2026-08-09"));
  assert.ok(requests.every(({ init }) => init.headers.Authorization === "Bearer test-token"));
});
