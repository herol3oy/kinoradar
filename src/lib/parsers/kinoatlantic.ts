import * as cheerio from 'cheerio';
import { fetchWithTimeout } from '../../server/fetch';

export async function parseKinoatlantic(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const url = `https://www.novekino.pl/kina/atlantic/repertuar.php?data=${day}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Kino Atlantic returned ${res.status}`);
  const $ = cheerio.load(await res.text());
  const shows: Array<any> = [];

  $('tr.repertoire-movie-tr').each((_, row) => {
    const title = $(row).find('.repertoire-movie-title a').first().text().trim();
    if (!title) return;

    const href = $(row).find('.repertoire-movie-title a').first().attr('href');
    const link = href ? `https://www.novekino.pl/kina/atlantic/${href}` : undefined;

    const posterSrc = $(row).find('.repertoire-movie-poster img').first().attr('src');
    const poster = posterSrc ? `https://www.novekino.pl${posterSrc}` : undefined;

    const times: string[] = [];
    $(row).find('.repertoire-movie-time').each((_, el) => {
      const hour = $(el).data('hour') || $(el).text().trim();
      if (hour) times.push(hour);
    });

    shows.push({ title, times, link, poster });
  });

  return shows;
}

export const siteName = 'Atlantic';
