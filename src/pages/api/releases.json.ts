import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { Locale } from "../../i18n/translations";
import {
  RELEASE_QUERY_MAX_LENGTH,
  paginateReleaseCatalog,
} from "../../lib/releases";
import { isDateKey, warsawDate } from "../../lib/warsaw-date";
import {
  getAvailableReleaseCatalog,
  readTmdbToken,
} from "../../server/releases";

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
    },
  });
}

function parseLocale(value: string | null): Locale | null {
  return value === "pl" || value === "en" ? value : null;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const locale = parseLocale(url.searchParams.get("locale"));
  const query = (url.searchParams.get("q") ?? "").trim();
  const cursor = url.searchParams.get("cursor");
  const genreValue = url.searchParams.get("genre");

  if (!locale) return json({ error: "locale must be pl or en" }, 400);
  if (query.length > RELEASE_QUERY_MAX_LENGTH) return json({ error: "q is too long" }, 400);
  if (cursor && !isDateKey(cursor)) return json({ error: "cursor must be a valid YYYY-MM-DD date" }, 400);
  if (genreValue !== null && !/^\d+$/.test(genreValue)) return json({ error: "genre must be a numeric ID" }, 400);

  try {
    const today = warsawDate();
    const catalog = await getAvailableReleaseCatalog(
      env.SHOWTIMES,
      readTmdbToken(env),
      locale,
      today,
    );
    const genreId = genreValue === null ? null : Number(genreValue);
    if (genreId !== null && !catalog.genres.some((genre) => genre.id === genreId)) {
      return json({ error: "unknown genre" }, 400);
    }

    return json(paginateReleaseCatalog(catalog, today, {
      query,
      genreId,
      cursor,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      message: "release catalog request failed",
      error: error instanceof Error ? error.message : String(error),
    }));
    return json({ error: "Upcoming releases are temporarily unavailable" }, 503);
  }
};
