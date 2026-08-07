import type { Show } from '../lib/normalize';

const KV_PREFIX = 'SHOWTIMES';
const KV_TTL_SECONDS = 86400; // 24 hours

function kvKey(date: string): string {
  return `${KV_PREFIX}:${date}`;
}

export async function getCachedShows(kv: KVNamespace, date: string): Promise<Show[] | null> {
  const raw = await kv.get(kvKey(date), 'json');
  if (!raw) return null;
  return raw as Show[];
}

export async function setCachedShows(kv: KVNamespace, date: string, data: Show[]): Promise<void> {
  await kv.put(kvKey(date), JSON.stringify(data), {
    expirationTtl: KV_TTL_SECONDS,
  });
}
