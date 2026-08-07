import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getCachedShows } from '../../server/kv';
import { getTodayShows } from '../../server/scraper';
import { setCachedShows } from '../../server/kv';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || undefined;
  const force = url.searchParams.get('force') === '1';

  try {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);

    if (!force) {
      const cached = await getCachedShows(env.SHOWTIMES, day);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
          },
        });
      }
    }

    const data = await getTodayShows(date);
    await setCachedShows(env.SHOWTIMES, day, data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
