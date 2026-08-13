import assert from "node:assert/strict";
import test from "node:test";

import { HELIOS_BLUE_CITY, heliosScreeningsUrl } from "../src/lib/helios.ts";
import { normalizeShow } from "../src/lib/normalize.ts";
import { parseHeliosBlueCity } from "../src/lib/parsers/helios.ts";

const FILM_SOURCE_ID = "ca0fb7b8-be54-4776-bfd3-7c34860ae2b9";
const EVENT_SOURCE_ID = "33bdfdd1-9612-4ece-8128-ada71d4e172b";

function payload() {
  return {
    status: 200,
    data: {
      screenings: {
        "2026-08-13": {
          m4497: {
            screenings: [
              {
                timeFrom: "2026-08-13 10:00:00",
                sourceId: "1feabe0b-0843-42e3-8d4a-e96cbedbbb4a",
                cinemaSourceId: HELIOS_BLUE_CITY.cinemaSourceId,
                cinemaScreen: { feature: "Dream" },
                moviePrint: {
                  printType: "3D",
                  printRelease: "3D/DUB/ATMOS",
                  soundType: "ATMOS",
                  speakingTypeLabel: "Dubbing",
                },
              },
              {
                timeFrom: "2026-08-14 10:00:00",
                sourceId: "2feabe0b-0843-42e3-8d4a-e96cbedbbb4a",
                cinemaSourceId: HELIOS_BLUE_CITY.cinemaSourceId,
              },
              {
                timeFrom: "2026-08-13 11:00:00",
                sourceId: "invalid",
                cinemaSourceId: HELIOS_BLUE_CITY.cinemaSourceId,
              },
            ],
          },
          e2674: {
            screenings: [{
              timeFrom: "2026-08-13 18:15:00",
              sourceId: "86478a45-cbac-403d-81aa-074600f356d9",
              cinemaSourceId: HELIOS_BLUE_CITY.cinemaSourceId,
              cinemaScreen: { feature: "" },
              screeningMovies: [{ moviePrint: {
                printType: "2D",
                printRelease: "2D/NAP",
                soundType: "5.1",
                speakingTypeLabel: "Napisy",
              } }],
            }],
          },
          broken: { screenings: [] },
        },
      },
      movies: {
        m4497: {
          id: 4497,
          sourceId: FILM_SOURCE_ID,
          title: "Щенячий патруль: Динофільм",
          slug: "shchenyachyy-patrul-dyno-fil-m-ua",
          flags: [{ name: "Dubbing" }, { name: "Wersja językowa UA" }],
          posterPhoto: { url: "https://img.helios.pl/pliki/film/poster.jpg" },
        },
      },
      events: {
        e2674: {
          id: 2674,
          sourceId: EVENT_SOURCE_ID,
          name: "Bodyguard w Helios RePlay",
          slug: "bodyguard-w-helios-replay",
          flags: [{ name: "Napisy" }],
          posterPhoto: { url: "https://img.helios.pl/pliki/wydarzenie/poster.png" },
        },
      },
    },
  };
}

test("maps Helios films, events, language, presentation, and ticket links", async () => {
  const requests = [];
  const shows = await parseHeliosBlueCity("2026-08-13", {
    fetcher: async (input, init) => {
      requests.push({ input: String(input), accept: new Headers(init.headers).get("Accept") });
      return Response.json(payload());
    },
  });

  assert.deepEqual(requests, [{ input: heliosScreeningsUrl(), accept: "application/json" }]);
  assert.equal(shows.length, 2);
  assert.equal(shows[0].title, "Щенячий патруль: Динофільм");
  assert.equal(
    shows[0].link,
    "https://helios.pl/warszawa/kino-helios-blue-city/filmy/shchenyachyy-patrul-dyno-fil-m-ua-4497",
  );
  assert.equal(shows[0].poster, "https://img.helios.pl/pliki/film/poster.jpg");
  assert.deepEqual(shows[0].screenings[0].language, { dubbed: true, audioLanguage: "uk" });
  assert.deepEqual(shows[0].screenings[0].presentation, {
    printType: "3D",
    soundType: "ATMOS",
    format: "DREAM",
    screenFeatures: ["DREAM"],
  });
  assert.deepEqual(shows[0].screenings[0].providerRef, {
    provider: "helios",
    screeningId: "1feabe0b-0843-42e3-8d4a-e96cbedbbb4a",
  });
  const ticket = new URL(shows[0].screenings[0].link);
  assert.equal(ticket.origin, "https://bilety.helios.pl");
  assert.equal(ticket.pathname, "/screen/1feabe0b-0843-42e3-8d4a-e96cbedbbb4a");
  assert.equal(ticket.searchParams.get("cinemaId"), HELIOS_BLUE_CITY.cinemaSourceId);
  assert.equal(ticket.searchParams.get("item_id"), FILM_SOURCE_ID);
  assert.equal(ticket.searchParams.get("item_source_id"), "4497");

  assert.equal(
    shows[1].link,
    "https://helios.pl/warszawa/kino-helios-blue-city/wydarzenie/bodyguard-w-helios-replay-2674",
  );
  assert.deepEqual(shows[1].screenings[0].language, { subtitled: true });
  assert.deepEqual(shows[1].screenings[0].presentation, { printType: "2D" });

  const normalized = shows.map((show) => normalizeShow(show, HELIOS_BLUE_CITY.name, HELIOS_BLUE_CITY.slug));
  assert.equal(normalized[0].screenings.length, 1);
  assert.equal(normalized[1].screenings[0].providerRef.provider, "helios");
});

test("returns an empty Helios schedule for an unpublished date", async () => {
  assert.deepEqual(await parseHeliosBlueCity("2026-08-14", {
    fetcher: async () => Response.json(payload()),
  }), []);
});

test("rejects unsuccessful and malformed Helios responses", async () => {
  await assert.rejects(
    parseHeliosBlueCity("2026-08-13", { fetcher: async () => new Response("down", { status: 503 }) }),
    /returned 503/,
  );
  await assert.rejects(
    parseHeliosBlueCity("2026-08-13", { fetcher: async () => Response.json({ status: 200, data: {} }) }),
    /invalid schedule response/,
  );
  const invalidDay = payload();
  invalidDay.data.screenings["2026-08-13"] = [];
  await assert.rejects(
    parseHeliosBlueCity("2026-08-13", { fetcher: async () => Response.json(invalidDay) }),
    /invalid day schedule/,
  );
});
