import axios from 'axios';
import * as cheerio from 'cheerio';

export async function parseKinocytadela(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const url = `https://muzhp.pl/repertuar`;
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const groups: Record<string, any> = {};

  $('div.repertoire-item').each((_, item) => {
    const title = $(item).find('.repertoire-item__content__title a').first().text().trim();
    if (!title) return;

    const href = $(item).find('.repertoire-item__content__title a').first().attr('href') || '';
    const link = href.startsWith('http') ? href : `https://muzhp.pl${href}`;

    const posterSrc = $(item).find('img.repertoire-item__image').first().attr('src');
    const poster = posterSrc ? (posterSrc.startsWith('http') ? posterSrc : `https://muzhp.pl${posterSrc}`) : undefined;

    const time = $(item).find('time.repertoire-item__time').first().attr('datetime') || $(item).find('time.repertoire-item__time').first().text().trim();

    const ticketHref = $(item).find('a.repertoire-item__container__button--dark').first().attr('href');
    const ticketLink = ticketHref || undefined;

    if (!groups[title]) {
      groups[title] = { title, times: [], link: ticketLink || link, poster };
    }
    if (time) groups[title].times.push(time);
  });

  return Object.values(groups);
}

export const siteName = 'Cytadela';
