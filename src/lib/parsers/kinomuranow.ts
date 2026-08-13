import * as cheerio from "cheerio";
import { fetchWithTimeout } from "../../server/fetch.ts";
import { isDateKey, warsawDate } from "../warsaw-date.ts";

const REPERTOIRE_URL = "https://kinomuranow.pl/repertuar";

const POLISH_MONTHS = new Map<string, number>([
  ["styczen", 1],
  ["stycznia", 1],
  ["luty", 2],
  ["lutego", 2],
  ["marzec", 3],
  ["marca", 3],
  ["kwiecien", 4],
  ["kwietnia", 4],
  ["maj", 5],
  ["maja", 5],
  ["czerwiec", 6],
  ["czerwca", 6],
  ["lipiec", 7],
  ["lipca", 7],
  ["sierpien", 8],
  ["sierpnia", 8],
  ["wrzesien", 9],
  ["wrzesnia", 9],
  ["pazdziernik", 10],
  ["pazdziernika", 10],
  ["listopad", 11],
  ["listopada", 11],
  ["grudzien", 12],
  ["grudnia", 12],
]);

type MuranowScreening = {
  time: string;
  link?: string;
};

type MuranowShow = {
  title: string;
  link?: string;
  poster?: string;
  screenings: MuranowScreening[];
};

function normalizedPolish(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl")
    .trim();
}

function monthNumber(value: string): number | undefined {
  return POLISH_MONTHS.get(normalizedPolish(value));
}

function calendarMonth(value: string): { year: number; month: number } | undefined {
  const match = /^\s*([^\d]+?)\s+(\d{4})\s*$/.exec(value);
  const month = match ? monthNumber(match[1]) : undefined;
  return match && month ? { year: Number(match[2]), month } : undefined;
}

function dateKey(year: number, month: number, day: number): string | undefined {
  const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isDateKey(value) ? value : undefined;
}

function dayDate(
  dayNumber: string,
  dayMonth: string,
  displayed: { year: number; month: number },
): string | undefined {
  const day = Number(dayNumber);
  const month = monthNumber(dayMonth);
  if (!Number.isInteger(day) || !month) return undefined;

  let year = displayed.year;
  if (displayed.month === 1 && month === 12) year -= 1;
  if (displayed.month === 12 && month === 1) year += 1;
  return dateKey(year, month, day);
}

function absoluteHttpUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function showKey(title: string): string {
  return title.toLocaleLowerCase("pl").replace(/\s+/g, " ").trim();
}

function addScreening(shows: Map<string, MuranowShow>, incoming: MuranowShow): void {
  const key = showKey(incoming.title);
  const existing = shows.get(key);
  if (!existing) {
    shows.set(key, incoming);
    return;
  }

  existing.link ||= incoming.link;
  existing.poster ||= incoming.poster;
  for (const screening of incoming.screenings) {
    const duplicate = existing.screenings.find((item) => item.time === screening.time);
    if (!duplicate) {
      existing.screenings.push(screening);
    } else if (!duplicate.link && screening.link) {
      duplicate.link = screening.link;
    }
  }
}

export async function parseKinomuranow(
  date?: string | Date,
  url = REPERTOIRE_URL,
): Promise<MuranowShow[]> {
  const requestedDay = typeof date === "string" ? date : warsawDate(date);
  if (!isDateKey(requestedDay)) throw new RangeError(`Invalid Muranów date: ${requestedDay}`);

  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Muranów returned ${response.status}`);

  const $ = cheerio.load(await response.text());
  const displayed = calendarMonth($(".calendar-seance-full__month-label").first().text());
  if (!displayed) throw new Error("Muranów returned an invalid calendar response");

  const availableDays = new Set<string>();
  const shows = new Map<string, MuranowShow>();

  $("div.calendar-seance-full__day").each((_, dayElement) => {
    const day = $(dayElement);
    const dayNumber = day.find(".cell-date-header__day-num").first().text().trim();
    const dayMonth = day
      .find(".cell-date-header__day-month, .cell-date-header__day-month-short")
      .first()
      .text()
      .trim();
    const currentDay = dayDate(dayNumber, dayMonth, displayed);
    if (!currentDay) return;
    availableDays.add(currentDay);
    if (currentDay !== requestedDay) return;

    day.find("div.movie-calendar-info").each((__, movieElement) => {
      const movie = $(movieElement);
      const title = movie.find(".movie-calendar-info__title").first().text().replace(/\s+/g, " ").trim();
      const time = movie.find(".movie-calendar-info__date").first().text().trim();
      if (!title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;

      const buyLink = absoluteHttpUrl(movie.find("a.c-button-tickets--buy-link").attr("href"), url);
      const reservationLink = absoluteHttpUrl(movie.find("a.c-button-tickets--res-link").attr("href"), url);
      const movieLink = absoluteHttpUrl(
        movie.find("a.c-button-tickets--movie-link, a.movie-calendar-info-expand__thumb").first().attr("href"),
        url,
      );
      const poster = absoluteHttpUrl(
        movie.find(".movie-calendar-info__media img, .movie-calendar-info-expand__thumb img").first().attr("src"),
        url,
      );

      addScreening(shows, {
        title,
        ...(movieLink ? { link: movieLink } : {}),
        ...(poster ? { poster } : {}),
        screenings: [{
          time,
          ...(buyLink || reservationLink ? { link: buyLink || reservationLink } : {}),
        }],
      });
    });
  });

  if (!availableDays.has(requestedDay)) {
    throw new Error(`Muranów calendar does not include ${requestedDay}`);
  }

  return [...shows.values()]
    .map((show) => ({
      ...show,
      screenings: show.screenings.sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort((a, b) => (
      a.screenings[0].time.localeCompare(b.screenings[0].time)
      || a.title.localeCompare(b.title, "pl")
    ));
}

export const siteName = "Muranów";
