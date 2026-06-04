import axios from 'axios';
import * as cheerio from 'cheerio';

export async function parseKinomuranow(date?: string | Date, url = 'https://kinomuranow.pl/repertuar') {
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const shows: Array<any> = [];

  $('div.calendar-seance-full__day').each((_, day) => {
    const dayLabel = $(day).find('.cell-date-header__day-name').text().trim();
    const dayNum = $(day).find('.cell-date-header__day-num').text().trim();
    const dayMonth = $(day).find('.cell-date-header__day-month, .cell-date-header__day-month-short').first().text().trim();
    const dayName = [dayLabel, dayNum, dayMonth].filter(Boolean).join(' ').trim();

    $(day).find('div.movie-calendar-info').each((_, movie) => {
      const title = $(movie).find('.movie-calendar-info__title').first().text().trim();
      if (!title) return;

      const posterSrc = $(movie).find('.movie-calendar-info__media img, .movie-calendar-info-expand__thumb img').first().attr('src');
      const poster = posterSrc || undefined;

      const times: string[] = [];
      $(movie).find('.movie-calendar-info__date').each((_, timeEl) => {
        const txt = $(timeEl).text().trim();
        if (txt) times.push(txt);
      });

      const link =
        $(movie).find('a.c-button-tickets--movie-link').attr('href') ||
        $(movie).find('a.movie-calendar-info-expand__thumb').attr('href') ||
        $(movie).find('a.c-button-tickets--res-link').attr('href') ||
        $(movie).find('a.c-button-tickets--buy-link').attr('href');

      const show: any = { title, times, link, poster };
      if (dayName) show.day = dayName;
      shows.push(show);
    });
  });

  if (shows.length === 0) {
    $('.movie-calendar-info__title').each((_, el) => {
      const title = $(el).text().trim();
      if (title) shows.push({ title, times: [] });
    });
  }

  if (date) {
    const dayStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
    const [y, m, d] = dayStr.split('-').map(Number);
    const polishMonths = ['', 'sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
    const monthAbbr = polishMonths[m];
    return shows.filter(s => s.day && s.day.includes(String(d)) && s.day.includes(monthAbbr));
  }

  return shows;
}

export const siteName = 'Muranów';
