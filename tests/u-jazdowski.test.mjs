import assert from "node:assert/strict";
import test from "node:test";

import { normalizeShow } from "../src/lib/normalize.ts";
import { parseUJazdowski } from "../src/lib/parsers/u-jazdowski.ts";

const SUMMER_TIMESTAMP = 1786658400;
const WINTER_TIMESTAMP = 1768431600;

function card({
  title = "Wpatrując się w słońce",
  time = "17:00",
  detail = "/kino/repertuar/wpatrujac-sie-w-slonce-",
  poster = "/upload/thumb/poster.jpg",
} = {}) {
  return `
    <a href="${detail}" class="event-list-day-box">
      <picture><img src="${poster}"></picture>
      <div class="hours">${time}</div>
      <div class="title"><em>${title}</em></div>
    </a>`;
}

function page(activeTimestamp, cards = "") {
  return `
    <div class="calendar-week">
      <nav id="calendar-nav">
        <a href="/kino/repertuar?ut=${activeTimestamp}" class="cal-nav-day active">Selected</a>
      </nav>
      <div id="calendar-items">${cards}</div>
    </div>`;
}

test("requests the compact calendar fragment and groups valid screenings", async () => {
  let request;
  const shows = await parseUJazdowski("2026-08-14", {
    fetcher: async (input, init) => {
      request = { url: new URL(String(input)), accept: new Headers(init.headers).get("Accept") };
      return new Response(page(SUMMER_TIMESTAMP, [
        card({ title: "  Wpatrując się\n w&nbsp;słońce  ", time: "9·05" }),
        card({ title: "Wpatrując się w słońce", time: "20:00" }),
        card({ title: "Unsafe", time: "19:30", detail: "https://evil.example/film", poster: "https://evil.example/poster.jpg" }),
        card({ title: "Bad time", time: "25:00" }),
      ].join("")));
    },
  });

  assert.equal(request.url.origin, "https://u-jazdowski.pl");
  assert.equal(request.url.pathname, "/kino/repertuar/week.ajax");
  assert.equal(request.url.searchParams.get("ut"), String(SUMMER_TIMESTAMP));
  assert.equal(request.accept, "text/html");

  assert.equal(shows.length, 2);
  assert.equal(shows[0].title, "Wpatrując się w słońce");
  assert.equal(shows[0].link, "https://u-jazdowski.pl/kino/repertuar/wpatrujac-sie-w-slonce-");
  assert.equal(shows[0].poster, "https://u-jazdowski.pl/upload/thumb/poster.jpg");
  assert.deepEqual(shows[0].screenings, [
    { time: "09:05", link: "https://u-jazdowski.pl/kino/repertuar/wpatrujac-sie-w-slonce-" },
    { time: "20:00", link: "https://u-jazdowski.pl/kino/repertuar/wpatrujac-sie-w-slonce-" },
  ]);
  assert.deepEqual(shows[1], { title: "Unsafe", screenings: [{ time: "19:30" }] });

  const normalized = normalizeShow(shows[0], "U-Jazdowski", "u-jazdowski");
  assert.deepEqual(normalized.times, ["09:05", "20:00"]);
  assert.equal(normalized.screenings[0].link, shows[0].link);
});

test("uses Warsaw dates and winter offsets for Date arguments", async () => {
  let request;
  await parseUJazdowski(new Date("2026-01-14T23:30:00Z"), {
    fetcher: async (input) => {
      request = new URL(String(input));
      return new Response(page(WINTER_TIMESTAMP));
    },
  });

  assert.equal(request.searchParams.get("ut"), String(WINTER_TIMESTAMP));
});

test("returns an empty schedule for a valid published date", async () => {
  const shows = await parseUJazdowski("2026-08-14", {
    fetcher: async () => new Response(page(SUMMER_TIMESTAMP)),
  });
  assert.deepEqual(shows, []);
});

test("rejects invalid dates, HTTP errors, malformed pages, and wrong returned dates", async () => {
  await assert.rejects(
    parseUJazdowski("2026-02-31", { fetcher: async () => new Response("") }),
    /Invalid U-Jazdowski date/,
  );
  await assert.rejects(
    parseUJazdowski("2026-08-14", { fetcher: async () => new Response("down", { status: 503 }) }),
    /returned 503/,
  );
  await assert.rejects(
    parseUJazdowski("2026-08-14", { fetcher: async () => new Response("<main></main>") }),
    /invalid schedule page/,
  );
  await assert.rejects(
    parseUJazdowski("2026-08-14", { fetcher: async () => new Response(page(1786572000)) }),
    /wrong schedule date/,
  );
});
