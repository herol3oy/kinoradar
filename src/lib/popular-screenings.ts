import { showTitleKey, titleMatchKeys, type FilmwebFilm } from "./filmweb.ts";
import type { Show } from "./normalize.ts";
import type { Screening } from "./screening-language.ts";

export const POPULAR_SCREENINGS_LIMIT = 12;

export type PopularScreeningItem = {
  filmwebId: number;
  title: string;
  displayTitle: string;
  year: number | null;
  posterUrl: string | null;
  cinema: string;
  source?: string;
  screening: Screening;
  upcoming: boolean;
};

function toMinutes(value: string): number | null {
  const match = value.match(/(?:^|\D)([01]?\d|2[0-3])[:.]([0-5]\d)(?:\D|$)/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

type Candidate = {
  show: Show;
  screening: Screening;
  minutes: number;
};

function candidatesFor(shows: Show[]): Candidate[] {
  return shows.flatMap((show) => show.screenings.flatMap((screening) => {
    const minutes = toMinutes(screening.time);
    return minutes === null ? [] : [{ show, screening, minutes }];
  }));
}

function pickCandidate(candidates: Candidate[], nowMinutes: number): Candidate | null {
  if (!candidates.length) return null;
  const upcoming = candidates.filter((candidate) => candidate.minutes >= nowMinutes);
  const pool = upcoming.length ? upcoming : candidates;
  return pool.reduce((best, candidate) => (candidate.minutes < best.minutes ? candidate : best));
}

export function buildPopularScreenings(
  films: FilmwebFilm[],
  shows: Show[],
  nowMinutes: number,
  limit: number = POPULAR_SCREENINGS_LIMIT,
): PopularScreeningItem[] {
  const showsByTitle = new Map<string, Show[]>();
  shows.forEach((show) => {
    const key = showTitleKey(show);
    if (!key) return;
    const existing = showsByTitle.get(key);
    if (existing) existing.push(show);
    else showsByTitle.set(key, [show]);
  });

  const items: PopularScreeningItem[] = [];

  for (const film of films) {
    if (items.length >= limit) break;

    const matched = titleMatchKeys(film).flatMap((key) => showsByTitle.get(key) ?? []);
    if (!matched.length) continue;

    const candidate = pickCandidate(candidatesFor(matched), nowMinutes);
    if (!candidate) continue;

    items.push({
      filmwebId: film.id,
      title: candidate.show.canonicalTitle,
      displayTitle: film.title,
      year: film.year,
      posterUrl: film.posterUrl ?? candidate.show.poster ?? null,
      cinema: candidate.show.cinema,
      source: candidate.show.source,
      screening: candidate.screening,
      upcoming: candidate.minutes >= nowMinutes,
    });
  }

  return items;
}
