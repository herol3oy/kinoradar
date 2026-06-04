import { parseKinoteka, siteName as kinotekaName } from '../lib/parsers/kinoteka';
import { parseKinomuranow, siteName as muranowName } from '../lib/parsers/kinomuranow';
import { parseUJazdowski, siteName as ujName } from '../lib/parsers/u-jazdowski';
import { normalizeMany } from '../lib/normalize';

type Cached = { ts: number; data: any } | null;
const cache: Record<string, Cached> = {};
const TTL = 1000 * 60 * 5; // 5 minutes

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

  const results = await Promise.allSettled([
    parseKinoteka(day),
    parseKinomuranow(),
    parseUJazdowski(),
  ]);
  const all: any[] = [];

  if (results[0].status === 'fulfilled') {
    all.push(...normalizeMany(results[0].value, kinotekaName, 'kinoteka'));
  } else if (results[0].status === 'rejected') {
    console.error('Kinoteka parser error:', results[0].reason);
  }
  if (results[1].status === 'fulfilled') {
    all.push(...normalizeMany(results[1].value, muranowName, 'kinomuranow'));
  } else if (results[1].status === 'rejected') {
    console.error('Kino Muranów parser error:', results[1].reason);
  }
  if (results[2].status === 'fulfilled') {
    all.push(...normalizeMany(results[2].value, ujName, 'u-jazdowski'));
  } else if (results[2].status === 'rejected') {
    console.error('U-Jazdowski parser error:', results[2].reason);
  }

  const seen = new Set();
  const deduped = all.filter((s) => {
    const key = `${s.title.toLowerCase()}|${s.cinema || s.source || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  cache[day] = { ts: now, data: deduped };
  return deduped;
}
