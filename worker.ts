import { handle } from '@astrojs/cloudflare/handler';
import { getShowsReport } from './src/server/scraper';
import { setCachedShows } from './src/server/kv';
import { addCalendarDays, warsawDate } from './src/lib/warsaw-date';
import {
  readTmdbToken,
  refreshReleaseCatalogIfStale,
} from './src/server/releases';
import { refreshPopularFilmsIfStale } from './src/server/filmweb';
import { scheduledJobFor } from './src/server/scheduled-jobs';

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

  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const today = warsawDate(new Date(controller.scheduledTime));
    const job = scheduledJobFor(controller.cron);

    if (!job) {
      console.error(JSON.stringify({
        message: 'unknown cron trigger',
        cron: controller.cron,
      }));
      controller.noRetry();
      return;
    }

    const scrapeAndStore = async (date: string) => {
      try {
        const result = await getShowsReport(date);
        await setCachedShows(env.SHOWTIMES, date, result.shows, result.failedCinemas);
        console.log(JSON.stringify({ message: 'schedule cached', date, shows: result.shows.length }));
      } catch (err) {
        console.error(JSON.stringify({
          message: 'schedule refresh failed',
          date,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    };

    const refreshReleases = async () => {
      const token = readTmdbToken(env);
      for (const locale of ['pl', 'en'] as const) {
        try {
          const catalog = await refreshReleaseCatalogIfStale(
            env.SHOWTIMES,
            token,
            locale,
            today,
          );
          if (catalog) {
            console.log(JSON.stringify({
              message: 'release catalog cached',
              locale,
              releases: catalog.releases.length,
            }));
            // A complete catalog can require many paginated subrequests. Refresh
            // at most one locale per cron invocation; the next run picks up the other.
            return;
          }
        } catch (err) {
          console.error(JSON.stringify({
            message: 'release catalog refresh failed',
            locale,
            error: err instanceof Error ? err.message : String(err),
          }));
          return;
        }
      }
    };

    const refreshPopularFilms = async () => {
      try {
        const cache = await refreshPopularFilmsIfStale(env.SHOWTIMES);
        if (cache) {
          console.log(JSON.stringify({
            message: 'popular films cached',
            films: cache.films.length,
          }));
        }
      } catch (err) {
        console.error(JSON.stringify({
          message: 'popular films refresh failed',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    };

    ctx.waitUntil(job.kind === 'schedule'
      ? scrapeAndStore(addCalendarDays(today, job.dayOffset))
      : job.kind === 'filmweb'
      ? refreshPopularFilms()
      : refreshReleases());
  },
} satisfies ExportedHandler<Env>;
