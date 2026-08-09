import * as cheerio from 'cheerio';
import { fetchWithTimeout } from '../../server/fetch';

export async function parseIluzjon(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const timestamp = Math.floor(new Date(day + 'T00:00:00').getTime() / 1000);
  const url = `https://www.iluzjon.fn.org.pl/repertuar/ajax/${timestamp}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Iluzjon returned ${res.status}`);
  const $ = cheerio.load(await res.text());
  const groups: Record<string, any> = {};

  $('table.times tbody tr').each((_, item) => {
    const title = $(item).find('td.name h5 a').first().text().trim();
    if (!title) return;

    const href = $(item).find('td.name h5 a').first().attr('href') || '';
    const link = href.startsWith('http') ? href : `https://www.iluzjon.fn.org.pl/${href}`;

    const movieId = href.match(/\/info\/(\d+)\//)?.[1];
    const poster = movieId ? `https://www.iluzjon.fn.org.pl/public/covers/movie-${movieId}.jpg` : undefined;

    const time = $(item).find('td.date').first().text().trim();

    const ticketHref = $(item).find('td.name a[href*="typetran=0"]').first().attr('href');
    const ticketLink = ticketHref || undefined;

    if (!groups[title]) {
      groups[title] = { title, times: [], link: ticketLink || link, poster };
    }
    if (time) groups[title].times.push(time);
  });

  return Object.values(groups);
}

export const siteName = 'Iluzjon';
