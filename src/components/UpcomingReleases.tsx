import { useEffect, useRef, useState } from "react";
import { countLabel, translations, type Locale } from "../i18n/translations";
import {
  RELEASE_QUERY_MAX_LENGTH,
  type ReleaseGroup,
  type ReleasePageData,
  type UpcomingRelease,
} from "../lib/releases";

interface Props {
  locale: Locale;
  initialPage: ReleasePageData;
  initialQuery: string;
  initialGenreId: number | null;
  loadError?: boolean;
}

function formattedDate(locale: Locale, value: string): string {
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${value}T12:00:00Z`));
}

function ReleaseCard({ locale, release }: { locale: Locale; release: UpcomingRelease }) {
  const t = translations[locale].releases;
  const showOriginalTitle = release.originalTitle.localeCompare(release.title, locale, { sensitivity: "base" }) !== 0;

  return (
    <article className="group grid min-h-full grid-cols-[104px_1fr] overflow-hidden border border-white/8 bg-retro-card transition-all duration-300 hover:-translate-y-1 hover:border-retro-yellow/45 hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)] sm:grid-cols-[140px_1fr]">
      <div className="relative min-h-40 overflow-hidden bg-black sm:min-h-52">
        {release.posterUrl ? (
          <img
            src={release.posterUrl}
            alt=""
            width="500"
            height="750"
            loading="lazy"
            className="size-full object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
          />
        ) : (
          <div className="grid size-full place-items-center bg-[linear-gradient(145deg,rgba(255,0,255,0.08),rgba(0,255,255,0.06))] text-center text-[10px] tracking-[0.24em] text-gray-700 uppercase">
            {t.noPoster}
          </div>
        )}
        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-retro-card to-transparent" />
      </div>
      <div className="flex min-w-0 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {release.genres.map((genre) => (
            <span key={genre.id} className="border border-retro-cyan/20 bg-retro-cyan/5 px-2 py-1 text-[8px] tracking-widest text-retro-cyan uppercase">
              {genre.name}
            </span>
          ))}
        </div>
        <h3 className="text-base font-bold leading-snug text-white sm:text-lg">
          {release.title} <span className="font-normal text-gray-600">({release.year})</span>
        </h3>
        {showOriginalTitle && (
          <p className="mt-1 text-[10px] leading-4 tracking-wide text-gray-600">{release.originalTitle}</p>
        )}
        {release.overview && (
          <p className="mt-4 line-clamp-4 text-xs leading-5 text-gray-500">{release.overview}</p>
        )}
        <a
          href={release.detailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center justify-between border-t border-white/8 pt-4 text-[10px] font-bold tracking-[0.16em] text-retro-yellow uppercase transition-colors hover:text-white"
        >
          {t.details} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

function ReleaseGroups({ locale, groups }: { locale: Locale; groups: ReleaseGroup[] }) {
  const t = translations[locale].releases;
  return (
    <div>
      {groups.map((group) => (
        <section key={group.date} className="mb-12 border-b border-white/8 pb-12 last:border-b-0">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <span className="mb-2 block text-[9px] tracking-[0.24em] text-gray-700 uppercase">{t.releaseDate}</span>
              <h2 className="text-xl font-bold capitalize tracking-wide text-white sm:text-2xl">
                {formattedDate(locale, group.date)}
              </h2>
            </div>
            <span className="shrink-0 text-[10px] tracking-widest text-gray-600 uppercase">
              {group.releases.length} {countLabel(locale, group.releases.length, translations[locale].hero.films)}
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {group.releases.map((release) => (
              <ReleaseCard key={release.id} locale={locale} release={release} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function UpcomingReleases({
  locale,
  initialPage,
  initialQuery,
  initialGenreId,
  loadError = false,
}: Props) {
  const t = translations[locale].releases;
  const [query, setQuery] = useState(initialQuery);
  const [genreId, setGenreId] = useState(initialGenreId);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(loadError);
  const firstFilterEffect = useRef(true);
  const requestController = useRef<AbortController | null>(null);

  const syncUrl = (nextQuery: string, nextGenreId: number | null) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextGenreId !== null) params.set("genre", String(nextGenreId));
    const suffix = params.size ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${suffix}`);

    const localeSwitch = document.querySelector<HTMLAnchorElement>("[data-locale-switch]");
    if (localeSwitch) localeSwitch.href = `${localeSwitch.pathname}${suffix}`;
  };

  const requestPage = async (cursor: string | null, append: boolean) => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setLoadingMore(false);
    }
    setError(false);

    const params = new URLSearchParams({ locale });
    if (query.trim()) params.set("q", query.trim());
    if (genreId !== null) params.set("genre", String(genreId));
    if (cursor) params.set("cursor", cursor);

    try {
      const response = await fetch(`/api/releases.json?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Failed to fetch releases");
      const nextPage = await response.json() as ReleasePageData;
      setPage((current) => ({
        ...nextPage,
        groups: append ? [...current.groups, ...nextPage.groups] : nextPage.groups,
      }));
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
      if (!append) setPage((current) => ({ ...current, groups: [], nextCursor: null, totalReleases: 0, totalGroups: 0 }));
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        append ? setLoadingMore(false) : setLoading(false);
      }
    }
  };

  useEffect(() => {
    syncUrl(query, genreId);
    if (firstFilterEffect.current) {
      firstFilterEffect.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      void requestPage(null, false);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query, genreId]);

  useEffect(() => () => requestController.current?.abort(), []);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <section className="mb-8 grid gap-6 border-b border-white/8 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-3 text-[10px] tracking-[0.3em] text-retro-magenta uppercase">{t.eyebrow}</p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            {t.title} <span className="text-retro-cyan [text-shadow:0_0_24px_rgba(0,255,255,0.3)]">{t.accent}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-500">{t.description}</p>
        </div>
        <div className="text-right">
          <span className="block text-2xl font-bold text-white">{page.totalReleases}</span>
          <span className="text-[9px] tracking-[0.2em] text-gray-600 uppercase">
            {countLabel(locale, page.totalReleases, translations[locale].hero.films)}
          </span>
        </div>
      </section>

      <section aria-label={t.filters} className="mb-8 border border-white/8 bg-white/[0.02] p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_280px_auto] md:items-end">
          <label className="block">
            <span className="mb-2 block text-[9px] tracking-[0.2em] text-gray-600 uppercase">{t.search}</span>
            <input
              type="search"
              value={query}
              maxLength={RELEASE_QUERY_MAX_LENGTH}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full border border-white/10 bg-black/30 px-3 py-3 text-xs text-white placeholder:text-gray-700 focus:border-retro-cyan"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[9px] tracking-[0.2em] text-gray-600 uppercase">{t.genre}</span>
            <select
              value={genreId ?? ""}
              onChange={(event) => setGenreId(event.target.value ? Number(event.target.value) : null)}
              className="w-full border border-white/10 bg-retro-card px-3 py-3 text-xs text-gray-300 focus:border-retro-cyan"
            >
              <option value="">{t.allGenres}</option>
              {page.genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => { setQuery(""); setGenreId(null); }}
            className="px-3 py-3 text-[10px] font-bold tracking-widest text-gray-600 uppercase transition-colors hover:text-retro-cyan"
          >
            {t.reset}
          </button>
        </div>
      </section>

      {page.stale && page.updatedAt && !error && (
        <aside className="mb-6 border border-retro-yellow/30 bg-retro-yellow/5 px-4 py-3 text-xs leading-5 tracking-wider text-retro-yellow uppercase" role="status">
          {t.stale} {new Date(page.updatedAt).toLocaleString(locale)}.
        </aside>
      )}

      {loading ? (
        <div className="grid min-h-72 place-items-center border border-white/8 bg-white/[0.015]">
          <div className="text-center">
            <span className="mx-auto mb-4 block size-8 animate-spin rounded-full border border-retro-cyan/20 border-t-retro-cyan" />
            <p className="text-xs tracking-[0.25em] text-retro-cyan uppercase">{t.loading}</p>
          </div>
        </div>
      ) : error ? (
        <div className="border border-dashed border-retro-yellow/25 bg-retro-yellow/[0.02] px-4 py-20 text-center" role="alert">
          <span className="mx-auto mb-5 grid size-12 place-items-center border border-retro-yellow/20 text-xl text-retro-yellow">!</span>
          <p className="text-xs font-bold tracking-[0.22em] text-retro-yellow uppercase">{t.loadFailed}</p>
          <button type="button" onClick={() => void requestPage(null, false)} className="mt-5 border border-retro-cyan/30 px-4 py-2 text-[10px] font-bold tracking-widest text-retro-cyan uppercase hover:border-retro-cyan">
            {t.retry}
          </button>
        </div>
      ) : page.groups.length === 0 ? (
        <div className="border border-dashed border-white/10 bg-white/[0.015] px-4 py-20 text-center">
          <span className="mx-auto mb-5 grid size-12 place-items-center border border-retro-yellow/20 text-xl text-retro-yellow">∅</span>
          <p className="text-xs font-bold tracking-[0.22em] text-retro-yellow uppercase">{t.empty}</p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-5 tracking-wider text-gray-600">{t.emptyDescription}</p>
        </div>
      ) : (
        <>
          <ReleaseGroups locale={locale} groups={page.groups} />
          {page.nextCursor && (
            <div className="mt-2 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void requestPage(page.nextCursor, true)}
                className="border border-retro-cyan/30 bg-retro-cyan/5 px-6 py-3 text-[10px] font-bold tracking-[0.2em] text-retro-cyan uppercase transition-colors hover:border-retro-cyan hover:bg-retro-cyan/10 disabled:opacity-50"
              >
                {loadingMore ? t.loading : t.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
