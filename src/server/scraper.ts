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
import { normalizeMany } from '../lib/normalize';

type Cached = { ts: number; data: any[] } | null;
const cache: Record<string, Cached> = {};
const TTL = 1000 * 60 * 5; // 5 minutes

// 1. Centralized configuration mapping for easy scaling
const CINEMA_PARSERS = [
  { parse: parseKinoteka, name: kinotekaName, slug: 'kinoteka', label: 'Kinoteka' },
  { parse: parseKinomuranow, name: muranowName, slug: 'kinomuranow', label: 'Kino Muranów' },
  { parse: parseUJazdowski, name: ujName, slug: 'u-jazdowski', label: 'U-Jazdowski' },
  { parse: parseKinowisla, name: wislaName, slug: 'kinowisla', label: 'Kino Wisła' },
  { parse: parseKinoatlantic, name: atlanticName, slug: 'kinoatlantic', label: 'Kino Atlantic' },
  { parse: parseKinoluna, name: kinolunaName, slug: 'kinoluna', label: 'Kinoluna' },
  { parse: parseKinokultura, name: kinokulturaName, slug: 'kinokultura', label: 'Kino Kultura' },
  { parse: parseKinoamondo, name: amondoName, slug: 'kinoamondo', label: 'Kino Amondo' },
  { parse: parseKinoelektronik, name: elektronikName, slug: 'kinoelektronik', label: 'Kino Elektronik' },
  { parse: parseKinocytadela, name: cytadelaName, slug: 'kinocytadela', label: 'Kino Cytadela' },
  { parse: parseIluzjon, name: iluzjonName, slug: 'iluzjon', label: 'Iluzjon' },
  { parse: parseKinogram, name: kinogramName, slug: 'kinogram', label: 'Kinogram' },
];

function normalizeDate(date?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayShows(date?: string, force = false) {
  const day = normalizeDate(date);
  const now = Date.now();
  const cached = cache[day];
  
  if (!force && cached && now - cached.ts < TTL) {
    return cached.data;
  }

  // 2. Map dynamically over the parsers
  const results = await Promise.allSettled(
    CINEMA_PARSERS.map((cinema) => cinema.parse(day))
  );
  
  const all: any[] = [];

  // 3. Process results safely using the index alignment guarantee
  results.forEach((result, index) => {
    const cinema = CINEMA_PARSERS[index];
    
    if (result.status === 'fulfilled') {
      all.push(...normalizeMany(result.value, cinema.name, cinema.slug));
    } else {
      console.error(`${cinema.label} parser error:`, result.reason);
    }
  });

  // 4. Deduplication
  const seen = new Set<string>();
  const deduped = all.filter((s) => {
    const key = `${s.title.toLowerCase()}|${s.cinema || s.source || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  cache[day] = { ts: now, data: deduped };
  return deduped;
}