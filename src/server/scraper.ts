import { parseKinoteka, siteName as kinotekaName } from '../lib/parsers/kinoteka';
import { parseKinomuranow, siteName as muranowName } from '../lib/parsers/kinomuranow';
import { parseUJazdowski, siteName as ujName } from '../lib/parsers/u-jazdowski';
import { parseKinowisla, siteName as wislaName } from '../lib/parsers/kinowisla';
import { parseKinoatlantic, siteName as atlanticName } from '../lib/parsers/kinoatlantic';
import { parseKinoluna, siteName as kinolunaName } from '../lib/parsers/kinoluna';
import { parseKinokultura, siteName as kinokulturaName } from '../lib/parsers/kinokultura';
import { parseKinoamondo, siteName as amondoName } from '../lib/parsers/kinoamondo';
import { parseKinoelektronik, siteName as elektronikName } from '../lib/parsers/kinoelektronik';
import { parseKinocytadela, siteName as cytadelaName } from '../lib/parsers/kinocytadela';
import { parseIluzjon, siteName as iluzjonName } from '../lib/parsers/iluzjon';
import { parseKinogram, siteName as kinogramName } from '../lib/parsers/kinogram';
import { normalizeMany, type Show } from '../lib/normalize';
import { cinemas } from '../data/cinemas';

export type ScrapeResult = {
  shows: Show[];
  failedCinemas: string[];
};

const CINEMA_PARSERS = [
  { ...cinemas[0], parse: parseKinoteka, name: kinotekaName },
  { ...cinemas[1], parse: parseKinomuranow, name: muranowName },
  { ...cinemas[2], parse: parseUJazdowski, name: ujName },
  { ...cinemas[3], parse: parseKinowisla, name: wislaName },
  { ...cinemas[4], parse: parseKinoatlantic, name: atlanticName },
  { ...cinemas[5], parse: parseKinoluna, name: kinolunaName },
  { ...cinemas[6], parse: parseKinokultura, name: kinokulturaName },
  { ...cinemas[7], parse: parseKinoamondo, name: amondoName },
  { ...cinemas[8], parse: parseKinoelektronik, name: elektronikName },
  { ...cinemas[9], parse: parseKinocytadela, name: cytadelaName },
  { ...cinemas[10], parse: parseIluzjon, name: iluzjonName },
  { ...cinemas[11], parse: parseKinogram, name: kinogramName },
];

function normalizeDate(date?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Date().toISOString().slice(0, 10);
}

export async function getShowsReport(date?: string): Promise<ScrapeResult> {
  const day = normalizeDate(date);

  const results = await Promise.allSettled(
    CINEMA_PARSERS.map((cinema) => cinema.parse(day))
  );

  const all: any[] = [];
  const failedCinemas: string[] = [];

  results.forEach((result, index) => {
    const cinema = CINEMA_PARSERS[index];

    if (result.status === 'fulfilled') {
      all.push(...normalizeMany(result.value, cinema.name, cinema.slug));
    } else {
      failedCinemas.push(cinema.label);
      console.error(`${cinema.label} parser error:`, result.reason);
    }
  });

  const seen = new Set<string>();
  const deduped = all.filter((s) => {
    const key = `${s.title.toLowerCase()}|${s.cinema || s.source || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { shows: deduped, failedCinemas };
}

export async function getTodayShows(date?: string): Promise<Show[]> {
  return (await getShowsReport(date)).shows;
}
