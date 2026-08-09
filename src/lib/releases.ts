import type { Locale } from "../i18n/translations.ts";
import { isDateKey } from "./warsaw-date.ts";

export const RELEASE_CATALOG_SCHEMA_VERSION = 1;
export const RELEASE_DATE_GROUP_BATCH_SIZE = 8;
export const RELEASE_QUERY_MAX_LENGTH = 100;

export type ReleaseGenre = {
  id: number;
  name: string;
};

export type UpcomingRelease = {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  releaseDate: string;
  year: number;
  posterUrl: string | null;
  genres: ReleaseGenre[];
  detailsUrl: string;
};

export type ReleaseCatalog = {
  schemaVersion: number;
  locale: Locale;
  generatedFor: string;
  updatedAt: string;
  genres: ReleaseGenre[];
  releases: UpcomingRelease[];
};

export type ReleaseGroup = {
  date: string;
  releases: UpcomingRelease[];
};

export type ReleasePageData = {
  groups: ReleaseGroup[];
  genres: ReleaseGenre[];
  nextCursor: string | null;
  totalReleases: number;
  totalGroups: number;
  updatedAt: string | null;
  stale: boolean;
};

export type ReleaseFilters = {
  query?: string;
  genreId?: number | null;
  cursor?: string | null;
};

export function normalizeReleaseSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Łł]/g, "l")
    .toLocaleLowerCase("pl")
    .replace(/\s+/g, " ")
    .trim();
}

function isReleaseGenre(value: unknown): value is ReleaseGenre {
  if (!value || typeof value !== "object") return false;
  const genre = value as Partial<ReleaseGenre>;
  return Number.isInteger(genre.id) && Number(genre.id) > 0
    && typeof genre.name === "string" && Boolean(genre.name.trim());
}

function isUpcomingRelease(value: unknown): value is UpcomingRelease {
  if (!value || typeof value !== "object") return false;
  const release = value as Partial<UpcomingRelease>;
  return Number.isInteger(release.id) && Number(release.id) > 0
    && typeof release.title === "string" && Boolean(release.title.trim())
    && typeof release.originalTitle === "string"
    && typeof release.overview === "string"
    && typeof release.releaseDate === "string" && isDateKey(release.releaseDate)
    && Number.isInteger(release.year)
    && (release.posterUrl === null || typeof release.posterUrl === "string")
    && Array.isArray(release.genres) && release.genres.every(isReleaseGenre)
    && typeof release.detailsUrl === "string";
}

export function isReleaseCatalog(value: unknown, locale?: Locale): value is ReleaseCatalog {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<ReleaseCatalog>;
  return catalog.schemaVersion === RELEASE_CATALOG_SCHEMA_VERSION
    && (catalog.locale === "pl" || catalog.locale === "en")
    && (!locale || catalog.locale === locale)
    && typeof catalog.generatedFor === "string"
    && isDateKey(catalog.generatedFor)
    && typeof catalog.updatedAt === "string"
    && Number.isFinite(Date.parse(catalog.updatedAt))
    && Array.isArray(catalog.genres) && catalog.genres.every(isReleaseGenre)
    && Array.isArray(catalog.releases) && catalog.releases.every(isUpcomingRelease);
}

export function isReleaseCatalogStale(
  catalog: ReleaseCatalog,
  now: Date = new Date(),
): boolean {
  return now.getTime() - Date.parse(catalog.updatedAt) >= 24 * 60 * 60 * 1000;
}

export function paginateReleaseCatalog(
  catalog: ReleaseCatalog,
  today: string,
  filters: ReleaseFilters = {},
): ReleasePageData {
  const query = normalizeReleaseSearch(filters.query ?? "");
  const genreId = filters.genreId ?? null;
  const cursor = filters.cursor && isDateKey(filters.cursor) ? filters.cursor : null;

  const filtered = catalog.releases.filter((release) => {
    if (release.releaseDate < today) return false;
    if (genreId !== null && !release.genres.some((genre) => genre.id === genreId)) return false;
    if (!query) return true;
    return normalizeReleaseSearch(`${release.title} ${release.originalTitle}`).includes(query);
  });

  const grouped = new Map<string, UpcomingRelease[]>();
  filtered.forEach((release) => {
    const existing = grouped.get(release.releaseDate);
    if (existing) existing.push(release);
    else grouped.set(release.releaseDate, [release]);
  });

  const allGroups = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, releases]) => ({ date, releases }));
  const remaining = cursor ? allGroups.filter((group) => group.date > cursor) : allGroups;
  const groups = remaining.slice(0, RELEASE_DATE_GROUP_BATCH_SIZE);
  const hasMore = remaining.length > groups.length;

  return {
    groups,
    genres: catalog.genres,
    nextCursor: hasMore ? groups.at(-1)?.date ?? null : null,
    totalReleases: filtered.length,
    totalGroups: allGroups.length,
    updatedAt: catalog.updatedAt,
    stale: isReleaseCatalogStale(catalog),
  };
}

export function emptyReleasePage(genres: ReleaseGenre[] = []): ReleasePageData {
  return {
    groups: [],
    genres,
    nextCursor: null,
    totalReleases: 0,
    totalGroups: 0,
    updatedAt: null,
    stale: false,
  };
}
