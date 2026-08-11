import {
  normalizeScreeningLanguage,
  parseScreeningTitle,
  screeningIdentity,
  type Screening,
  type ScreeningLanguage,
} from './screening-language.ts';

export type RawScreening = Partial<Screening> & { time?: string };

export type RawShow = {
  title?: string;
  times?: string[] | string;
  link?: string;
  screenings?: RawScreening[];
  [key: string]: any;
};

export type Show = {
  title: string;
  canonicalTitle: string;
  times: string[];
  screenings: Screening[];
  cinema: string;
  link?: string;
  source?: string;
  poster?: string;
};

function dedupeScreenings(screenings: Screening[]): Screening[] {
  const unique = new Map<string, Screening>();
  screenings.forEach((screening) => {
    const key = screeningIdentity(screening);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, screening);
    } else if (!existing.link && screening.link) {
      unique.set(key, { ...existing, link: screening.link });
    }
  });
  return [...unique.values()];
}

function normalizeRawScreening(
  raw: RawScreening,
  fallbackLink: string | undefined,
  fallbackLanguage: ScreeningLanguage,
): Screening | null {
  const time = typeof raw.time === 'string' ? raw.time.trim() : '';
  if (!time) return null;
  return {
    time,
    ...normalizeScreeningLanguage(raw, fallbackLanguage),
    ...(raw.link || fallbackLink ? { link: raw.link || fallbackLink } : {}),
    ...(raw.providerRef ? { providerRef: raw.providerRef } : {}),
    ...(raw.presentation ? { presentation: raw.presentation } : {}),
  };
}

export function normalizeShow(raw: RawShow, cinema: string, source?: string): Show {
  const title = (raw.title || raw.name || 'Unknown').trim();
  const { canonicalTitle, language } = parseScreeningTitle(title);
  const rawTimes = Array.isArray(raw.times)
    ? raw.times.map(String).map(t => t.trim()).filter(Boolean)
    : raw.times
    ? [String(raw.times).trim()]
    : [];
  const link = raw.link || raw.url || undefined;
  const poster = raw.poster || undefined;
  const rawScreenings = Array.isArray(raw.screenings) && raw.screenings.length
    ? raw.screenings
    : rawTimes.map((time) => ({ time }));
  const screenings = dedupeScreenings(
    rawScreenings
      .map((screening) => normalizeRawScreening(screening, link, language))
      .filter((screening): screening is Screening => screening !== null),
  );
  const times = [...new Set(screenings.map((screening) => screening.time))];
  return { title, canonicalTitle, times, screenings, cinema, link, source, poster };
}

export function normalizeMany(raws: RawShow[], cinema: string, source?: string) {
  return raws.map(r => normalizeShow(r, cinema, source));
}

export function withScreenings(show: Show, screenings: Screening[]): Show {
  const normalized = dedupeScreenings(screenings);
  return {
    ...show,
    screenings: normalized,
    times: [...new Set(normalized.map((screening) => screening.time))],
  };
}

function normalizedTitleKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Merge cinema-provided language variants into one card without changing the API records. */
export function mergeShowsForDisplay(shows: Show[]): Show[] {
  const groups = new Map<string, Show>();
  shows.forEach((show) => {
    const key = `${normalizedTitleKey(show.canonicalTitle)}|${show.cinema}|${show.source ?? ''}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        ...show,
        title: show.canonicalTitle,
        screenings: [...show.screenings],
        times: [...show.times],
      });
      return;
    }
    const merged = withScreenings(existing, [...existing.screenings, ...show.screenings]);
    groups.set(key, {
      ...merged,
      poster: existing.poster || show.poster,
      link: existing.link || show.link,
    });
  });
  return [...groups.values()];
}
