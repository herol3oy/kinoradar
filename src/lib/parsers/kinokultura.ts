import * as cheerio from 'cheerio';
import { fetchWithTimeout } from '../../server/fetch';

export async function parseKinokultura(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const url = `https://rezerwacja.kinokultura.pl/MSI/mvc/pl?sort=Name&date=${day}&datestart=0`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Kino Kultura returned ${res.status}`);
  const $ = cheerio.load(await res.text());
  const shows: Array<any> = [];

  $('div.movies-movie').each((_, movie) => {
    const titleEl = $(movie).find('h2.movies-movie__single__title').first();
    const title = titleEl.text().trim();
    if (!title) return;

    const posterEl = $(movie).find('.movies-movie__single__poster img').first();
    const posterSrc = posterEl.attr('src');
    const poster = posterSrc ? `https://rezerwacja.kinokultura.pl${posterSrc}` : undefined;

    const times: string[] = [];
    $(movie).find('.d-none.d-md-block.d-lg-flex .js-event-hours a').each((_, el) => {
      const time = $(el).text().trim();
      if (time) times.push(time);
    });

    const link = $(movie).find('.d-none.d-md-block.d-lg-flex .js-event-hours a').first().attr('href');
    const ticketLink = link ? `https://rezerwacja.kinokultura.pl${link}` : undefined;

    shows.push({ title, times, poster, link: ticketLink });
  });

  return shows;
}

export const siteName = 'Kultura';
