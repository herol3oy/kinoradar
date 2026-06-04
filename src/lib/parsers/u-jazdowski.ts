import axios from 'axios';
import * as cheerio from 'cheerio';

export async function parseUJazdowski(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [y, m, d] = day.split('-').map(Number);
  const ut = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000) - 7200;
  const url = `https://u-jazdowski.pl/kino/repertuar?ut=${ut}`;
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const shows: Array<any> = [];

  $('a.event-list-day-box').each((_, el) => {
    const title = $(el).find('div.title em').first().text().trim();
    if (!title) return;

    const posterSrc = $(el).find('picture img').first().attr('src');
    const poster = posterSrc ? `https://u-jazdowski.pl${posterSrc}` : undefined;

    const times: string[] = [];
    const hoursText = $(el).find('div.hours').text();
    if (hoursText) {
      const match = hoursText.match(/(\d+)\s*[:\u00b7]\s*(\d+)/);
      if (match) {
        times.push(`${match[1]}:${match[2]}`);
      }
    }

    const href = $(el).attr('href');
    const link = href ? (href.startsWith('http') ? href : `https://u-jazdowski.pl${href}`) : undefined;

    shows.push({ title, times, link, poster });
  });

  if (shows.length === 0) {
    $('div.title em').each((_, el) => {
      const title = $(el).text().trim();
      if (title) shows.push({ title, times: [] });
    });
  }

  return shows;
}

export const siteName = 'U-Jazdowski';
