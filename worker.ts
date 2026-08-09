import { handle } from '@astrojs/cloudflare/handler';
import { getShowsReport } from './src/server/scraper';
import { setCachedShows } from './src/server/kv';
import { addCalendarDays, warsawDate } from './src/lib/warsaw-date';

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
    const today = warsawDate();
    const tomorrow = addCalendarDays(today, 1);

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
