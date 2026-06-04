import axios from 'axios';
import * as cheerio from 'cheerio';

export async function parseKinoluna(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const url = `https://kinoluna.bilety24.pl/?b24_day=${day}`;
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const shows: Array<any> = [];

  $('div.list-item').each((_, item) => {
    const title = $(item).find('.list-item-title a').first().text().trim();
    if (!title) return;

    const href = $(item).find('.list-item-title a').first().attr('href');
    const link = href || undefined;

    const times: string[] = [];
    $(item).find('.b24-button--active .b24-button__hour').each((_, el) => {
      const hour = $(el).text().trim();
      if (hour) times.push(hour);
    });

    shows.push({ title, times, link });
  });

  return shows;
}

export const siteName = 'Kinoluna';
