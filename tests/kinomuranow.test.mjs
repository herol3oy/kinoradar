import assert from "node:assert/strict";
import test from "node:test";

import { parseKinomuranow } from "../src/lib/parsers/kinomuranow.ts";

function screening({
  id,
  time,
  title,
  movieLink = `/film/${id}`,
  poster,
  buy = false,
  reserve = false,
}) {
  return `
    <div class="movie-calendar-info">
      <div class="movie-calendar-info__inner" data-id="${id}">
        <span class="movie-calendar-info__date">${time}</span>
        <h5 class="movie-calendar-info__title">${title}</h5>
      </div>
      <div class="movie-calendar-info-expand">
        ${movieLink ? `<a class="movie-calendar-info-expand__thumb" href="${movieLink}">
          ${poster ? `<img src="${poster}">` : ""}
        </a>` : ""}
        <div class="movie-calendar-info-expand__links">
          ${movieLink ? `<a class="c-button-tickets--movie-link" href="${movieLink}">opis filmu</a>` : ""}
          ${reserve ? `<a class="c-button-tickets--res-link" href="/tickets/${id}/res">Rezerwuj</a>` : ""}
          ${buy ? `<a class="c-button-tickets--buy-link" href="/tickets/${id}/buy">Kup bilet</a>` : ""}
        </div>
      </div>
    </div>`;
}

function day(number, month, contents = "") {
  return `
    <div class="calendar-seance-full__day">
      <div class="cell-date-header">
        <span class="cell-date-header__day-num">${number}</span>
        <span class="cell-date-header__day-month-short">${month}</span>
      </div>
      ${contents}
    </div>`;
}

function calendar() {
  return `
    <p class="calendar-seance-full__month-label">Grudzień 2026</p>
    ${day(30, "listopada")}
    ${day(1, "grudnia", [
      screening({
        id: "101",
        time: "18:00",
        title: "  Film testowy ",
        poster: "javascript:alert(1)",
        buy: true,
        reserve: true,
      }),
      screening({
        id: "102",
        time: "15:30",
        title: "Film   testowy",
        movieLink: "/film/film-testowy",
        poster: "/images/film-testowy.jpg",
        reserve: true,
      }),
      screening({
        id: "103",
        time: "18:00",
        title: "Film testowy",
        movieLink: "/film/film-testowy",
      }),
      screening({
        id: "104",
        time: "20:00",
        title: "Wyprzedany film",
        poster: "https://images.example/wyprzedany.jpg",
      }),
    ].join(""))}
    ${day(10, "grudnia", screening({
      id: "201",
      time: "19:00",
      title: "Film tylko dziesiątego",
      buy: true,
    }))}
    ${day(31, "grudnia")}
    ${day(1, "stycznia", screening({
      id: "301",
      time: "11:00",
      title: "Film noworoczny",
      buy: true,
    }))}
  `;
}

function mockFetch(t, response) {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => response;
}

test("matches the exact date and groups screenings with per-screening ticket links", async (t) => {
  mockFetch(t, new Response(calendar()));

  const result = await parseKinomuranow("2026-12-01");

  assert.equal(result.length, 2);
  assert.equal(result[0].title, "Film testowy");
  assert.equal(result[0].link, "https://kinomuranow.pl/film/101");
  assert.equal(result[0].poster, "https://kinomuranow.pl/images/film-testowy.jpg");
  assert.deepEqual(result[0].screenings, [
    { time: "15:30", link: "https://kinomuranow.pl/tickets/102/res" },
    { time: "18:00", link: "https://kinomuranow.pl/tickets/101/buy" },
  ]);
  assert.equal(result[1].title, "Wyprzedany film");
  assert.deepEqual(result[1].screenings, [{ time: "20:00" }]);
  assert.ok(result.every((show) => show.title !== "Film tylko dziesiątego"));
});

test("uses the Warsaw day for Date arguments and resolves adjacent calendar years", async (t) => {
  mockFetch(t, new Response(calendar()));

  const result = await parseKinomuranow(new Date("2026-12-31T23:30:00Z"));

  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Film noworoczny");
  assert.deepEqual(result[0].screenings, [{
    time: "11:00",
    link: "https://kinomuranow.pl/tickets/301/buy",
  }]);
});

test("returns an empty schedule when the requested calendar day has no screenings", async (t) => {
  mockFetch(t, new Response(calendar()));
  assert.deepEqual(await parseKinomuranow("2026-12-31"), []);
});

test("rejects absent dates, invalid markup, invalid dates, and HTTP errors", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => new Response(calendar());
  await assert.rejects(parseKinomuranow("2026-12-15"), /does not include 2026-12-15/);
  await assert.rejects(parseKinomuranow("2026-02-30"), /Invalid Muranów date/);

  globalThis.fetch = async () => new Response(day(1, "grudnia"));
  await assert.rejects(parseKinomuranow("2026-12-01"), /invalid calendar response/);

  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  await assert.rejects(parseKinomuranow("2026-12-01"), /Muranów returned 503/);
});
