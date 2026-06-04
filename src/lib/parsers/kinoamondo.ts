import axios from 'axios';
import * as cheerio from 'cheerio';

export async function parseKinoamondo(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const url = 'https://kinoamondo.pl/';
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const shows: Array<any> = [];

  const panelId = `schedule-${day}`;
  const panel = $(`#${panelId}`);
  if (!panel.length) return shows;

  panel.find('div.row.movie-tabs').each((_, movie) => {
    const title = $(movie).find('h3.no-underline').first().text().trim();
    if (!title) return;

    const posterSrc = $(movie).find('div.col-md-2 a img').first().attr('src');
    let poster: string | undefined;
    if (posterSrc) {
      poster = posterSrc.startsWith('//') ? `https:${posterSrc}` : posterSrc;
    }

    const link = $(movie).find('div.col-md-2 a').first().attr('href') || undefined;

    const times: string[] = [];
    $(movie).find('span.time').each((_, el) => {
      const txt = $(el).text().trim();
      const match = txt.match(/(\d{1,2}:\d{2})/);
      if (match) times.push(match[1]);
    });

    shows.push({ title, times, link, poster });
  });

  return shows;
}

export const siteName = 'Amondo';
