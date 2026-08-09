import type { Show } from '../lib/normalize';

const KV_PREFIX = 'SHOWTIMES';
const KV_TTL_SECONDS = 86400; // 24 hours

export type ScheduleCache = {
  shows: Show[];
  updatedAt: string | null;
  failedCinemas: string[];
};

function kvKey(date: string): string {
  return `${KV_PREFIX}:${date}`;
}

export async function getCachedSchedule(kv: KVNamespace, date: string): Promise<ScheduleCache | null> {
  const raw = await kv.get(kvKey(date), 'json');
  if (!raw) return null;

  // Entries created before schedule metadata was introduced contain only the array.
  if (Array.isArray(raw)) {
    return { shows: raw as Show[], updatedAt: null, failedCinemas: [] };
  }

  return raw as ScheduleCache;
}

export async function getCachedShows(kv: KVNamespace, date: string): Promise<Show[] | null> {
  return (await getCachedSchedule(kv, date))?.shows ?? null;
}

export async function setCachedShows(
  kv: KVNamespace,
  date: string,
  shows: Show[],
  failedCinemas: string[] = [],
): Promise<ScheduleCache> {
  const data = { shows, failedCinemas, updatedAt: new Date().toISOString() };
  await kv.put(kvKey(date), JSON.stringify(data), {
    expirationTtl: KV_TTL_SECONDS,
  });
  return data;
}
