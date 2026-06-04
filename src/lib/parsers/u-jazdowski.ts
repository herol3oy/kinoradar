import axios from 'axios';
import * as cheerio from 'cheerio';

export async function parseUJazdowski(url = 'https://u-jazdowski.pl/kino/repertuar') {
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const shows: Array<any> = [];

  $('a.event-list-day-box').each((_, el) => {
    const title = $(el).find('div.title em').first().text().trim();
    if (!title) return;

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

    shows.push({ title, times, link });
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
