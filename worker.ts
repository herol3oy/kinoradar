import { handle } from '@astrojs/cloudflare/handler';
import { getTodayShows } from './src/server/scraper';
import { setCachedShows } from './src/server/kv';

function normalizeDate(date?: string): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Date().toISOString().slice(0, 10);
}

export default {
  fetch: handle,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const today = normalizeDate();
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const scrapeAndStore = async (date: string) => {
      try {
        const shows = await getTodayShows(date);
        await setCachedShows(env.SHOWTIMES, date, shows);
        console.log(`[cron] Cached ${shows.length} shows for ${date}`);
      } catch (err) {
        console.error(`[cron] Failed to scrape ${date}:`, err);
      }
    };

    ctx.waitUntil(Promise.all([scrapeAndStore(today), scrapeAndStore(tomorrow)]));
  },
};
