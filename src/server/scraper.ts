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
import { parseKinomuzeum, siteName as kinomuzeumName } from '../lib/parsers/kinomuzeum';
import { parseKinopraha, siteName as kinoprahaName } from '../lib/parsers/kinopraha';
import { parseMultikinoCinema } from '../lib/parsers/multikino';
import { normalizeMany, type Show } from '../lib/normalize';
import { cinemas, getCinema } from '../data/cinemas';
import { MULTIKINO_CINEMAS } from '../lib/multikino';
import { normalizeWarsawDate } from '../lib/warsaw-date';
import { createMultikinoClient } from './multikino';

export type ScrapeResult = {
  shows: Show[];
  failedCinemas: string[];
};

const CORE_CINEMA_PARSERS = [
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
  { ...cinemas[12], parse: parseKinomuzeum, name: kinomuzeumName },
  { ...cinemas[13], parse: parseKinopraha, name: kinoprahaName },
];

function cinemaParsers() {
  const multikinoClient = createMultikinoClient();
  const multikinoParsers = MULTIKINO_CINEMAS.map((config) => {
    const cinema = getCinema(config.slug);
    if (!cinema) throw new Error(`Missing cinema registry entry for ${config.slug}`);
    return {
      ...cinema,
      parse: (day: string) => parseMultikinoCinema(config.key, day, { client: multikinoClient }),
    };
  });
  return [...CORE_CINEMA_PARSERS, ...multikinoParsers];
}

export async function getShowsReport(date?: string): Promise<ScrapeResult> {
  const day = normalizeWarsawDate(date);
  const parsers = cinemaParsers();

  const results = await Promise.allSettled(
    parsers.map((cinema) => cinema.parse(day))
  );

  const all: any[] = [];
  const failedCinemas: string[] = [];

  results.forEach((result, index) => {
    const cinema = parsers[index];

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
