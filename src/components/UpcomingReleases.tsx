import { useEffect, useRef, useState } from "react";
import { countLabel, translations, type Locale } from "../i18n/translations";
import {
  RELEASE_QUERY_MAX_LENGTH,
  type ReleaseGroup,
  type ReleasePageData,
  type UpcomingRelease,
} from "../lib/releases";
import Poster from "./Poster";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { RiCalendarEventLine, RiExternalLinkLine } from "@remixicon/react";

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
    <article className="h-full">
      <Card className="grid h-full grid-cols-[7rem_1fr] items-start sm:grid-cols-[10rem_1fr]">
      <Poster locale={locale} src={release.posterUrl} className="w-28 shrink-0 self-start sm:w-40" />
      <CardContent className="flex min-w-0 flex-col py-4 sm:py-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {release.genres.map((genre) => (
            <Badge key={genre.id} variant="secondary">
              {genre.name}
            </Badge>
          ))}
        </div>
        <h3 className="font-heading text-base font-semibold leading-snug sm:text-lg">
          {release.title} <span className="font-normal text-muted-foreground">({release.year})</span>
        </h3>
        {showOriginalTitle && (
          <p className="mt-1 text-xs leading-4 text-muted-foreground">{release.originalTitle}</p>
        )}
        {release.overview && (
          <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">{release.overview}</p>
        )}
        <CardFooter className="mt-auto -mx-(--card-spacing) border-t border-border pt-4">
        <a
          href={release.detailsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-between text-sm font-medium text-primary transition-colors hover:text-foreground"
        >
          {t.details} <RiExternalLinkLine size={16} aria-hidden="true" />
        </a>
        </CardFooter>
      </CardContent>
      </Card>
    </article>
  );
}

function ReleaseGroups({ locale, groups }: { locale: Locale; groups: ReleaseGroup[] }) {
  const t = translations[locale].releases;
  return (
    <div>
      {groups.map((group) => (
        <section key={group.date} className="mb-10 border-b border-border pb-10 last:border-b-0">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">{t.releaseDate}</span>
              <h2 className="font-heading text-xl font-semibold capitalize sm:text-2xl">
                {formattedDate(locale, group.date)}
              </h2>
            </div>
            <Badge variant="outline" className="shrink-0">
              {group.releases.length} {countLabel(locale, group.releases.length, translations[locale].hero.films)}
            </Badge>
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
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="mb-8 grid gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-3 text-xs font-medium text-primary">{t.eyebrow}</p>
          <h1 className="max-w-3xl font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {t.title} <span className="text-primary">{t.accent}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex items-center lg:justify-end">
          <Badge variant="secondary" className="h-8 px-3">
            {page.totalReleases} {countLabel(locale, page.totalReleases, translations[locale].hero.films)}
          </Badge>
        </div>
      </section>

      <section aria-label={t.filters} className="mb-8 border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_16rem_auto] md:items-end">
          <div>
            <Label htmlFor="release-search" className="text-muted-foreground">{t.search}</Label>
            <Input
              id="release-search"
              type="search"
              value={query}
              maxLength={RELEASE_QUERY_MAX_LENGTH}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="release-genre" className="text-muted-foreground">{t.genre}</Label>
            <Select value={genreId === null ? null : String(genreId)} onValueChange={(value) => setGenreId(value ? Number(value) : null)}>
              <SelectTrigger id="release-genre" className="mt-2 w-full"><SelectValue placeholder={t.allGenres} /></SelectTrigger>
              <SelectContent>
                {page.genres.map((genre) => <SelectItem key={genre.id} value={String(genre.id)}>{genre.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setQuery(""); setGenreId(null); }}
          >
            {t.reset}
          </Button>
        </div>
      </section>

      {page.stale && page.updatedAt && !error && (
        <Alert className="mb-6" role="status">
          <AlertDescription>
          {t.stale} {new Date(page.updatedAt).toLocaleString(locale)}.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid min-h-72 place-items-center border border-border bg-card">
          <div className="text-center">
            <Spinner className="mx-auto mb-3 size-5 text-primary" />
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          </div>
        </div>
      ) : error ? (
        <Empty className="min-h-72 border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><RiCalendarEventLine className="size-4" aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>{t.loadFailed}</EmptyTitle>
          </EmptyHeader>
          <Button type="button" onClick={() => void requestPage(null, false)}>{t.retry}</Button>
        </Empty>
      ) : page.groups.length === 0 ? (
        <Empty className="min-h-72 border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><RiCalendarEventLine className="size-4" aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>{t.empty}</EmptyTitle>
            <EmptyDescription>{t.emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ReleaseGroups locale={locale} groups={page.groups} />
          {page.nextCursor && (
            <div className="mt-2 text-center">
            <Button
              type="button"
              variant="outline"
              disabled={loadingMore}
              onClick={() => void requestPage(page.nextCursor, true)}
            >
              {loadingMore ? t.loading : t.loadMore}
            </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
