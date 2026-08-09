import * as cheerio from 'cheerio';
import { fetchWithTimeout } from '../../server/fetch';

export async function parseKinoluna(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const url = `https://kinoluna.bilety24.pl/?b24_day=${day}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Kinoluna returned ${res.status}`);
  const $ = cheerio.load(await res.text());
  const shows: Array<any> = [];

  $('div.list-item').each((_, item) => {
    const title = $(item).find('.list-item-title a').first().text().trim();
    if (!title) return;

    const href = $(item).find('.list-item-title a').first().attr('href');
    const link = href || undefined;

    const posterSrc = $(item).find('.list-item-image img.b24-image').first().attr('src');
    const poster = posterSrc || undefined;

    const times: string[] = [];
    $(item).find('.b24-button--active .b24-button__hour').each((_, el) => {
      const hour = $(el).text().trim();
      if (hour) times.push(hour);
    });

    shows.push({ title, times, link, poster });
  });

  return shows;
}

export const siteName = 'Kinoluna';
