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
    parseKinomuranow(day),
    parseUJazdowski(day),
    parseKinowisla(day),
    parseKinoatlantic(day),
    parseKinoluna(day),
    parseKinokultura(day),
    parseKinoamondo(day),
    parseKinoelektronik(day),
    parseKinocytadela(day),
    parseIluzjon(day),
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
  if (results[3].status === 'fulfilled') {
    all.push(...normalizeMany(results[3].value, wislaName, 'kinowisla'));
  } else if (results[3].status === 'rejected') {
    console.error('Kino Wisła parser error:', results[3].reason);
  }
  if (results[4].status === 'fulfilled') {
    all.push(...normalizeMany(results[4].value, atlanticName, 'kinoatlantic'));
  } else if (results[4].status === 'rejected') {
    console.error('Kino Atlantic parser error:', results[4].reason);
  }
  if (results[5].status === 'fulfilled') {
    all.push(...normalizeMany(results[5].value, kinolunaName, 'kinoluna'));
  } else if (results[5].status === 'rejected') {
    console.error('Kinoluna parser error:', results[5].reason);
  }
  if (results[6].status === 'fulfilled') {
    all.push(...normalizeMany(results[6].value, kinokulturaName, 'kinokultura'));
  } else if (results[6].status === 'rejected') {
    console.error('Kino Kultura parser error:', results[6].reason);
  }
  if (results[7].status === 'fulfilled') {
    all.push(...normalizeMany(results[7].value, amondoName, 'kinoamondo'));
  } else if (results[7].status === 'rejected') {
    console.error('Kino Amondo parser error:', results[7].reason);
  }
  if (results[8].status === 'fulfilled') {
    all.push(...normalizeMany(results[8].value, elektronikName, 'kinoelektronik'));
  } else if (results[8].status === 'rejected') {
    console.error('Kino Elektronik parser error:', results[8].reason);
  }
  if (results[9].status === 'fulfilled') {
    all.push(...normalizeMany(results[9].value, cytadelaName, 'kinocytadela'));
  } else if (results[9].status === 'rejected') {
    console.error('Kino Cytadela parser error:', results[9].reason);
  }
  if (results[10].status === 'fulfilled') {
    all.push(...normalizeMany(results[10].value, iluzjonName, 'iluzjon'));
  } else if (results[10].status === 'rejected') {
    console.error('Iluzjon parser error:', results[10].reason);
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
