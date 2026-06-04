import { parseKinoteka, siteName as kinotekaName } from '../lib/parsers/kinoteka';
import { parseKinomuranow, siteName as muranowName } from '../lib/parsers/kinomuranow';
import { parseUJazdowski, siteName as ujName } from '../lib/parsers/u-jazdowski';
import { normalizeMany } from '../lib/normalize';

type Cached = { ts: number; data: any } | null;
let cache: Cached = null;
const TTL = 1000 * 60 * 5; // 5 minutes

export async function getTodayShows(force = false) {
  const now = Date.now();
  if (!force && cache && now - cache.ts < TTL) {
    return cache.data;
  }

  const results = await Promise.allSettled([parseKinoteka(), parseKinomuranow(), parseUJazdowski()]);
  const all: any[] = [];

  if (results[0].status === 'fulfilled') {
    all.push(...normalizeMany(results[0].value, kinotekaName, 'kinoteka'));
  }
  if (results[1].status === 'fulfilled') {
    all.push(...normalizeMany(results[1].value, muranowName, 'kinomuranow'));
  }
  if (results[2].status === 'fulfilled') {
    all.push(...normalizeMany(results[2].value, ujName, 'u-jazdowski'));
  }

  const seen = new Set();
  const deduped = all.filter((s) => {
    const key = `${s.title.toLowerCase()}|${s.cinema || s.source || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  cache = { ts: now, data: deduped };
  return deduped;
}
