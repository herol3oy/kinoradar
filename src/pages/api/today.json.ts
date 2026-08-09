import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getCachedSchedule } from '../../server/kv';
import { getShowsReport } from '../../server/scraper';
import { setCachedShows } from '../../server/kv';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || undefined;
  const force = url.searchParams.get('force') === '1';
  const includeMeta = url.searchParams.get('meta') === '1';

  try {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().slice(0, 10);

    if (!force) {
      const cached = await getCachedSchedule(env.SHOWTIMES, day);
      if (cached) {
        return new Response(JSON.stringify(includeMeta ? cached : cached.shows), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
          },
        });
      }
    }

    const result = await getShowsReport(date);
    const data = await setCachedShows(env.SHOWTIMES, day, result.shows, result.failedCinemas);

    return new Response(JSON.stringify(includeMeta ? data : data.shows), {
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
