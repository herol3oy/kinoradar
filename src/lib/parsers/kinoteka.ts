import axios from 'axios';
import * as cheerio from 'cheerio';

export async function parseKinoteka(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const url = `https://kinoteka.pl/repertuar/?date=${day}`;
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const shows: Array<any> = [];

  $('ul.e-movies-grid > li').each((_, item) => {
    const article = $(item).find('article.e-movie').first();
    if (!article.length) return;

    const title = article.find('h3.e-movie__heading a.e-movie__heading-link').first().text().trim();
    if (!title) return;

    const link =
      article.find('h3.e-movie__heading a.e-movie__heading-link').attr('href') ||
      article.find('a.e-movie__thumbnail-link').attr('href') ||
      article.find('a.e-movie__footer-buy').attr('href');

    const posterSrc = article.find('img.e-movie__thumbnail-img').first().attr('src');
    const poster = posterSrc || undefined;

    const times: string[] = [];
    article.find('ul.e-movie__footer-screenings li a').each((_, show) => {
      const time =
        $(show).attr('data-repertoire-hour') ||
        $(show).attr('data-hour') ||
        $(show).text().trim();
      if (time) times.push(time.trim());
    });

    shows.push({ title, link, times, poster });
  });

  return shows;
}

export const siteName = 'Kinoteka';
