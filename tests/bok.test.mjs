import assert from "node:assert/strict";
import test from "node:test";

import { parseBokCinema, warsawMidnightEpochSeconds } from "../src/lib/parsers/bok.ts";

function page(heading = "13 sierpnia 2026") {
  return `
    <div class="movies-children-upcomming">
      <div class="basic-list-item"><a class="movie-list" href="/kino-glebocka-66/teaser">
        <div class="movie-list-descr"><div class="fs-30">Nie jest seansem</div></div>
        <span class="movieshow-list-movie-descr">09:00</span>
      </a></div>
    </div>
    <div class="calendar-children">
      <div><strong>${heading}</strong></div>
      <div class="basic-list-item">
        <a class="movie-list" href="/kino-glebocka-66/psi-patrol-i-dinozaury-218521363">
          <img src="/upload/thumb/poster.jpg">
          <div class="movie-list-descr"><div class="fs-30">Psi Patrol i dinozaury | PREMIERA</div></div>
          <span class="movieshow-list-movie-descr">15:00</span>
          <span class="movieshow-list-movie-descr">15:00</span>
          <span class="movieshow-list-movie-descr">25:00</span>
        </a>
      </div>
      <div class="basic-list-item">
        <a class="movie-list" href="https://evil.example/film">
          <div class="movie-list-descr"><div class="fs-30">Unsafe</div></div>
          <span class="movieshow-list-movie-descr">18:00</span>
        </a>
      </div>
    </div>`;
}

test("constructs BOK schedule dates at Warsaw midnight across DST boundaries", () => {
  assert.equal(new Date(warsawMidnightEpochSeconds("2026-01-15") * 1000).toISOString(), "2026-01-14T23:00:00.000Z");
  assert.equal(new Date(warsawMidnightEpochSeconds("2026-03-29") * 1000).toISOString(), "2026-03-28T23:00:00.000Z");
  assert.equal(new Date(warsawMidnightEpochSeconds("2026-10-25") * 1000).toISOString(), "2026-10-24T22:00:00.000Z");
  assert.throws(() => warsawMidnightEpochSeconds("2026-02-31"), /Invalid date key/);
});

test("parses only the requested BOK cinema calendar", async () => {
  let request;
  const shows = await parseBokCinema("glebocka-66", "2026-08-13", {
    fetcher: async (input, init) => {
      request = { url: String(input), accept: new Headers(init.headers).get("Accept") };
      return new Response(page());
    },
  });

  assert.deepEqual(request, {
    url: "https://bok.waw.pl/kino-glebocka-66,ts:1786572000",
    accept: "text/html",
  });
  assert.deepEqual(shows, [{
    title: "Psi Patrol i dinozaury",
    link: "https://bok.waw.pl/kino-glebocka-66/psi-patrol-i-dinozaury-218521363",
    poster: "https://bok.waw.pl/upload/thumb/poster.jpg",
    screenings: [{
      time: "15:00",
      link: "https://bok.waw.pl/kino-glebocka-66/psi-patrol-i-dinozaury-218521363",
    }],
    screeningLinksAreExplicit: true,
  }]);
});

test("uses the independent Kino na boku route", async () => {
  let url;
  const html = page().replaceAll("kino-glebocka-66", "kino-na-boku");
  const shows = await parseBokCinema("na-boku", "2026-08-13", {
    fetcher: async (input) => {
      url = String(input);
      return new Response(html);
    },
  });
  assert.equal(url, "https://bok.waw.pl/kino-na-boku,ts:1786572000");
  assert.equal(shows[0].link, "https://bok.waw.pl/kino-na-boku/psi-patrol-i-dinozaury-218521363");
});

test("rejects BOK HTTP, markup, and returned-date failures", async () => {
  await assert.rejects(
    parseBokCinema("glebocka-66", "2026-08-13", { fetcher: async () => new Response("", { status: 503 }) }),
    /returned 503/,
  );
  await assert.rejects(
    parseBokCinema("glebocka-66", "2026-08-13", { fetcher: async () => new Response("<main></main>") }),
    /invalid schedule page/,
  );
  await assert.rejects(
    parseBokCinema("glebocka-66", "2026-08-13", { fetcher: async () => new Response(page("14 sierpnia 2026")) }),
    /wrong schedule date/,
  );
});
