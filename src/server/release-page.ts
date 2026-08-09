import type { Locale } from "../i18n/translations";
import {
  RELEASE_QUERY_MAX_LENGTH,
  emptyReleasePage,
  paginateReleaseCatalog,
  type ReleasePageData,
} from "../lib/releases";
import { warsawDate } from "../lib/warsaw-date";
import { getAvailableReleaseCatalog, readTmdbToken } from "./releases";

export type InitialReleasePage = {
  initialPage: ReleasePageData;
  initialQuery: string;
  initialGenreId: number | null;
  loadError: boolean;
};

export async function loadInitialReleasePage(
  kv: KVNamespace,
  environment: object,
  locale: Locale,
  url: URL,
): Promise<InitialReleasePage> {
  const initialQuery = (url.searchParams.get("q") ?? "").trim().slice(0, RELEASE_QUERY_MAX_LENGTH);
  const genreValue = url.searchParams.get("genre");
  const requestedGenreId = genreValue && /^\d+$/.test(genreValue) ? Number(genreValue) : null;

  try {
    const today = warsawDate();
    const catalog = await getAvailableReleaseCatalog(
      kv,
      readTmdbToken(environment),
      locale,
      today,
    );
    const initialGenreId = requestedGenreId !== null
      && catalog.genres.some((genre) => genre.id === requestedGenreId)
      ? requestedGenreId
      : null;

    return {
      initialPage: paginateReleaseCatalog(catalog, today, {
        query: initialQuery,
        genreId: initialGenreId,
      }),
      initialQuery,
      initialGenreId,
      loadError: false,
    };
  } catch (error) {
    console.error(JSON.stringify({
      message: "initial release page failed",
      locale,
      error: error instanceof Error ? error.message : String(error),
    }));
    return {
      initialPage: emptyReleasePage(),
      initialQuery,
      initialGenreId: null,
      loadError: true,
    };
  }
}
