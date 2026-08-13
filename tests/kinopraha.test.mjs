import assert from "node:assert/strict";
import test from "node:test";

import { parseKinopraha } from "../src/lib/parsers/kinopraha.ts";

function ticketingEvent(overrides = {}) {
  return {
    wydarzenie: "Film testowy",
    terminGodzina: "18:00",
    czas: "2026-08-12 (środa) 18:00",
    terminUrl: "https://butik.mteatr.pl/rezerwacja/miejsca.html?id=100&idt=token",
    przyciskDostepny: true,
    ...overrides,
  };
}

function repertoireCard({
  title = "Film testowy",
  label = "12 Sie 2026 / 18:00",
  detail = "/pl/film-testowy",
  poster = "/uploads/thumbnail/film-testowy.jpg",
} = {}) {
  return `
    <div class="post boxoffice-style">
      <a href="${detail}">
        <div class="label">${label}</div>
        <div class="image" data-src="${poster}"></div>
        <div class="box_tytul"><h2>${title}</h2></div>
      </a>
    </div>`;
}

function repertoire(cards = "") {
  return `<main id="repertory-page"><div class="tab-panel">${cards}</div></main>`;
}

function responseFor(url, { ticketing = [], html = repertoire() } = {}) {
  return url.hostname === "butik.mteatr.pl"
    ? Response.json({ status: "complete", data: ticketing })
    : new Response(html, { headers: { "Content-Type": "text/html" } });
}

test("maps the whole-day feed and enriches it with exact-date repertoire HTML", async () => {
  const requests = [];
  const fetcher = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    return responseFor(url, {
      ticketing: [
        ticketingEvent({ wydarzenie: "  Film   testowy  " }),
        ticketingEvent({ terminGodzina: "15:30", przyciskDostepny: false }),
        ticketingEvent({
          wydarzenie: "Drugi film",
          terminGodzina: "12:00",
          terminUrl: "https://evil.example/checkout",
        }),
        ticketingEvent({ terminGodzina: "25:00" }),
        ticketingEvent({ czas: "2026-08-13 (czwartek) 18:00" }),
        null,
      ],
      html: repertoire([
        repertoireCard(),
        repertoireCard({ label: "12 Sie 2026 / 20:00", detail: "/pl/film-testowy-wieczorem" }),
        repertoireCard({
          title: "Tylko HTML",
          label: "12 Sie 2026 / 11:00",
          detail: "/pl/tylko-html",
          poster: "/uploads/thumbnail/tylko-html.jpg",
        }),
        repertoireCard({ title: "Inny dzień", label: "13 Sie 2026 / 10:00" }),
      ].join("")),
    });
  };

  const result = await parseKinopraha("2026-08-12", { fetcher });

  assert.equal(requests.length, 2);
  const ticketingRequest = requests.find(({ url }) => url.hostname === "butik.mteatr.pl");
  assert.equal(ticketingRequest.url.pathname, "/index/ajax.html");
  assert.equal(ticketingRequest.url.searchParams.get("ajax"), "pobierzTerminy");
  assert.equal(ticketingRequest.url.searchParams.get("selectedDate"), "2026-08-12");
  assert.equal(ticketingRequest.url.searchParams.get("idl"), "0");
  assert.equal(ticketingRequest.url.searchParams.get("idw"), "");
  assert.equal(ticketingRequest.url.searchParams.get("idg"), "1");
  assert.equal(ticketingRequest.init.headers.Accept, "application/json");

  assert.deepEqual(result.map(({ title }) => title), ["Tylko HTML", "Drugi film", "Film testowy"]);
  assert.equal(result[0].poster, "https://www.mteatr.pl/uploads/thumbnail/tylko-html.jpg");
  assert.deepEqual(result[0].screenings, [{
    time: "11:00",
    link: "https://www.mteatr.pl/pl/tylko-html",
  }]);
  assert.deepEqual(result[1].screenings, [{ time: "12:00" }]);
  assert.equal(result[2].poster, "https://www.mteatr.pl/uploads/thumbnail/film-testowy.jpg");
  assert.deepEqual(result[2].screenings, [
    { time: "15:30" },
    {
      time: "18:00",
      link: "https://butik.mteatr.pl/rezerwacja/miejsca.html?id=100&idt=token",
    },
    { time: "20:00", link: "https://www.mteatr.pl/pl/film-testowy-wieczorem" },
  ]);
});

test("uses HTML as a fallback when ticketing is malformed", async (t) => {
  const originalError = console.error;
  t.after(() => { console.error = originalError; });
  console.error = () => {};

  const result = await parseKinopraha("2026-08-12", {
    fetcher: async (input) => {
      const url = new URL(String(input));
      return url.hostname === "butik.mteatr.pl"
        ? Response.json({ status: "failed", data: [] })
        : new Response(repertoire(repertoireCard()));
    },
  });

  assert.deepEqual(result, [{
    title: "Film testowy",
    poster: "https://www.mteatr.pl/uploads/thumbnail/film-testowy.jpg",
    screenings: [{ time: "18:00", link: "https://www.mteatr.pl/pl/film-testowy" }],
  }]);
});

test("keeps ticketing data when HTML enrichment fails", async (t) => {
  const originalError = console.error;
  t.after(() => { console.error = originalError; });
  console.error = () => {};

  const result = await parseKinopraha("2026-08-12", {
    fetcher: async (input) => {
      const url = new URL(String(input));
      return url.hostname === "butik.mteatr.pl"
        ? Response.json({ status: "complete", data: [ticketingEvent()] })
        : new Response("unavailable", { status: 503 });
    },
  });

  assert.deepEqual(result, [{
    title: "Film testowy",
    screenings: [{
      time: "18:00",
      link: "https://butik.mteatr.pl/rezerwacja/miejsca.html?id=100&idt=token",
    }],
  }]);
});

test("returns an empty schedule for a valid day with no events", async () => {
  const result = await parseKinopraha("2026-08-12", {
    fetcher: async (input) => responseFor(new URL(String(input))),
  });
  assert.deepEqual(result, []);
});

test("uses the Warsaw calendar day for Date arguments", async () => {
  let requestedDay;
  await parseKinopraha(new Date("2026-08-11T22:30:00Z"), {
    fetcher: async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "butik.mteatr.pl") requestedDay = url.searchParams.get("selectedDate");
      return responseFor(url);
    },
  });
  assert.equal(requestedDay, "2026-08-12");
});

test("rejects when both upstream sources fail", async () => {
  await assert.rejects(
    parseKinopraha("2026-08-12", {
      fetcher: async (input) => {
        const url = new URL(String(input));
        return url.hostname === "butik.mteatr.pl"
          ? new Response("unavailable", { status: 503 })
          : new Response("not a repertoire page");
      },
    }),
    /Kino Praha sources failed/,
  );
});
