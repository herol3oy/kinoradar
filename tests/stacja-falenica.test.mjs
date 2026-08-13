import assert from "node:assert/strict";
import test from "node:test";

import { normalizeShow } from "../src/lib/normalize.ts";
import { parseStacjaFalenica } from "../src/lib/parsers/stacja-falenica.ts";

function page(calendar) {
  const value = JSON.stringify(calendar).replaceAll("'", "&#39;");
  return `<main><div data-calendar-props='${value}'></div></main>`;
}

function calendar() {
  return {
    eventsByDate: {
      "2026-08-13": [
        { time: "18:00", title: "Pejzaż w kolorze sepii ", url: "/repertoire/show?id=34088", soldOut: false },
        { time: "20:30", title: "Pejzaż w kolorze sepii", url: "/repertoire/show?id=34095", soldOut: true },
        { time: "18:00", title: "Kandydaci śmierci", url: "/repertoire/show?id=34156", soldOut: false },
        { time: "19:00", title: "Unsafe", url: "https://evil.example/repertoire/show?id=9", soldOut: false },
        { time: "25:00", title: "Bad time", url: "/repertoire/show?id=10", soldOut: false },
        { time: "22:00", title: "Duplicate", url: "/repertoire/show?id=34088", soldOut: false },
      ],
    },
  };
}

test("maps Falenica calendar events and keeps sold-out sessions without ticket links", async () => {
  let request;
  const shows = await parseStacjaFalenica("2026-08-13", {
    fetcher: async (input, init) => {
      request = { url: String(input), accept: new Headers(init.headers).get("Accept") };
      return new Response(page(calendar()));
    },
  });

  assert.deepEqual(request, { url: "https://ksf.systembiletowy.pl/", accept: "text/html" });
  assert.equal(shows.length, 2);
  assert.equal(shows[0].title, "Pejzaż w kolorze sepii");
  assert.deepEqual(shows[0].screenings, [
    {
      time: "18:00",
      link: "https://ksf.systembiletowy.pl/repertoire/show?id=34088",
      providerRef: { provider: "stacja-falenica", screeningId: "34088" },
    },
    {
      time: "20:30",
      link: undefined,
      providerRef: { provider: "stacja-falenica", screeningId: "34095" },
    },
  ]);
  assert.equal(shows[1].screenings[0].time, "18:00");

  const normalized = normalizeShow(shows[0], "Kinokawiarnia Stacja Falenica", "stacja-falenica");
  assert.equal(normalized.screenings.length, 2);
  assert.equal(normalized.screenings[1].link, undefined);
});

test("returns an empty Falenica schedule for an unpublished date", async () => {
  assert.deepEqual(await parseStacjaFalenica("2026-08-14", {
    fetcher: async () => new Response(page(calendar())),
  }), []);
});

test("rejects Falenica HTTP, markup, JSON, and day-shape failures", async () => {
  await assert.rejects(
    parseStacjaFalenica("2026-08-13", { fetcher: async () => new Response("", { status: 503 }) }),
    /returned 503/,
  );
  await assert.rejects(
    parseStacjaFalenica("2026-08-13", { fetcher: async () => new Response("<main></main>") }),
    /invalid schedule page/,
  );
  await assert.rejects(
    parseStacjaFalenica("2026-08-13", { fetcher: async () => new Response("<div data-calendar-props='{bad}'></div>") }),
    /invalid calendar data/,
  );
  await assert.rejects(
    parseStacjaFalenica("2026-08-13", {
      fetcher: async () => new Response(page({ eventsByDate: { "2026-08-13": {} } })),
    }),
    /invalid day schedule/,
  );
});
