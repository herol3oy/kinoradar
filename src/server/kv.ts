import type { Show } from '../lib/normalize.ts';

const KV_PREFIX = 'SHOWTIMES';
const KV_TTL_SECONDS = 86400; // 24 hours
export const SCHEDULE_SCHEMA_VERSION = 11;

export type ScheduleCache = {
  schemaVersion: number;
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
  if (Array.isArray(raw)) return null;
  const cached = raw as Partial<ScheduleCache>;
  if (cached.schemaVersion !== SCHEDULE_SCHEMA_VERSION || !Array.isArray(cached.shows)) return null;
  return cached as ScheduleCache;
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
  const data = { schemaVersion: SCHEDULE_SCHEMA_VERSION, shows, failedCinemas, updatedAt: new Date().toISOString() };
  await kv.put(kvKey(date), JSON.stringify(data), {
    expirationTtl: KV_TTL_SECONDS,
  });
  return data;
}
