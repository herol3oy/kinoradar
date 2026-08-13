import assert from "node:assert/strict";
import test from "node:test";

import { normalizeShow } from "../src/lib/normalize.ts";
import { parseKinocytadela } from "../src/lib/parsers/kinocytadela.ts";

function item({
  title = "Niebo nad Normandią",
  time = "18:00",
  detail = "/kino-film/niebo-nad-normandia",
  poster = "/uploads/thumbs/poster.jpg",
  info = "napisy",
  ticket = "https://sklep.muzhp.pl/rezerwacja/rezerwacja/numerowane.html?id=18898&idt=token",
} = {}) {
  return `<div class="repertoire-item">
    <img class="repertoire-item__image" src="${poster}">
    <div class="repertoire-item__content__title"><a href="${detail}">${title}</a></div>
    <time class="repertoire-item__time" datetime="${time}">${time}</time>
    <div class="repertoire-item__info">${info}</div>
    <a class="repertoire-item__container__button--dark" href="${ticket}">Kup</a>
  </div>`;
}

function page() {
  return `
    <time class="repertoire-list__title" datetime="2026-09-05" data-time="2026-09-05"></time>
    ${item()}
    ${item({ time: "20:30", ticket: "https://sklep.muzhp.pl/rezerwacja/rezerwacja/numerowane.html?id=18899&idt=token2" })}
    <time class="repertoire-list__title" datetime="2026-09-06" data-time="2026-09-06"></time>
    ${item({
      title: "HISTORANKI Z MISIEM USZATKIEM",
      time: "11:00",
      info: "oryginalny",
      detail: "https://evil.example/film",
      poster: "https://evil.example/poster.jpg",
      ticket: "https://evil.example/checkout?id=10",
    })}`;
}

test("associates Cytadela repertoire items with the exact date heading", async () => {
  let request;
  const shows = await parseKinocytadela("2026-09-05", {
    fetcher: async (input, init) => {
      request = { url: String(input), accept: new Headers(init.headers).get("Accept") };
      return new Response(page());
    },
  });

  assert.deepEqual(request, { url: "https://muzhp.pl/repertuar", accept: "text/html" });
  assert.equal(shows.length, 1);
  assert.equal(shows[0].title, "Niebo nad Normandią");
  assert.equal(shows[0].link, "https://muzhp.pl/kino-film/niebo-nad-normandia");
  assert.equal(shows[0].poster, "https://muzhp.pl/uploads/thumbs/poster.jpg");
  assert.deepEqual(shows[0].screenings.map(({ time }) => time), ["18:00", "20:30"]);
  assert.deepEqual(shows[0].screenings[0].language, { subtitled: true });
  assert.deepEqual(shows[0].screenings[0].providerRef, { provider: "muzhp", screeningId: "18898" });
  assert.equal(shows[0].screenings[0].link, "https://sklep.muzhp.pl/rezerwacja/rezerwacja/numerowane.html?id=18898&idt=token");

  const normalized = normalizeShow(shows[0], "Cytadela", "kinocytadela");
  assert.equal(normalized.screenings.length, 2);
  assert.equal(normalized.screenings[0].providerRef.provider, "muzhp");
});

test("returns only the requested Cytadela day and rejects unsafe links", async () => {
  const shows = await parseKinocytadela("2026-09-06", { fetcher: async () => new Response(page()) });
  assert.equal(shows.length, 1);
  assert.equal(shows[0].title, "HISTORANKI Z MISIEM USZATKIEM");
  assert.equal(shows[0].link, undefined);
  assert.equal(shows[0].poster, undefined);
  assert.equal(shows[0].screenings[0].link, undefined);
  assert.equal(shows[0].screenings[0].providerRef, undefined);
  assert.equal(shows[0].screenings[0].language, undefined);

  assert.deepEqual(await parseKinocytadela("2026-08-13", {
    fetcher: async () => new Response(page()),
  }), []);
});

test("rejects Cytadela HTTP failures", async () => {
  await assert.rejects(
    parseKinocytadela("2026-09-05", { fetcher: async () => new Response("down", { status: 502 }) }),
    /returned 502/,
  );
});
