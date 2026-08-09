import { handle } from '@astrojs/cloudflare/handler';
import { getShowsReport } from './src/server/scraper';
import { setCachedShows } from './src/server/kv';

function normalizeDate(date?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Date().toISOString().slice(0, 10);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const response = await handle(request, env, ctx);

    if (!response.headers.get('content-type')?.includes('text/html')) {
      return response;
    }

    // Astro emits this island helper style beside the first hydrated component.
    // The rule also lives in global.css, so remove the invalid copy from <main>.
    return new HTMLRewriter()
      .on('main > style', {
        element(element) {
          element.remove();
        },
      })
      .transform(response);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const today = normalizeDate();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const scrapeAndStore = async (date: string) => {
      try {
        const result = await getShowsReport(date);
        await setCachedShows(env.SHOWTIMES, date, result.shows, result.failedCinemas);
        console.log(`[cron] Cached ${result.shows.length} shows for ${date}`);
      } catch (err) {
        console.error(`[cron] Failed to scrape ${date}:`, err);
      }
    };

    ctx.waitUntil(Promise.all([scrapeAndStore(today), scrapeAndStore(tomorrow)]));
  },
};
