import { useEffect, useState } from "react";
import { translations, type Locale } from "../i18n/translations";
import { decodeSharedFavorites, encodeSharedFavorites, favoriteFilmKey, favoriteKey, type FavoriteFilm } from "../lib/favorites";
import type { Show } from "../lib/normalize";
import type { Screening } from "../lib/screening-language";
import { filmSlug } from "../lib/film";
import ScreeningBadges from "./ScreeningBadges";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { RiExternalLinkLine, RiShareLine, RiStarFill, RiStarLine } from "@remixicon/react";

type Props = {
  locale: Locale;
  favorites: FavoriteFilm[];
  onRemove: (film: FavoriteFilm) => void;
  onClear: () => void;
};

type ScheduleResponse = { shows: Show[] };

export default function FavoritesPage({ locale, favorites, onRemove, onClear }: Props) {
  const t = translations[locale];
  const [sharedFilms, setSharedFilms] = useState<FavoriteFilm[] | null>(null);
  const [invalidLink, setInvalidLink] = useState(false);
  const [showsByFavorite, setShowsByFavorite] = useState<Map<string, { show: Show; screening: Screening }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("list");
    if (!encoded) return;
    const decoded = decodeSharedFavorites(encoded);
    setSharedFilms(decoded);
    setInvalidLink(decoded.length === 0);
  }, []);

  const isShared = sharedFilms !== null;
  const films = isShared ? sharedFilms : favorites;
  const dates = [...new Set(films.map((film) => film.date))];
  const dateKey = dates.join(",");

  useEffect(() => {
    if (!films.length) {
      setShowsByFavorite(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(dates.map(async (date) => {
      const response = await fetch(`/api/today.json?date=${encodeURIComponent(date)}&meta=1`);
      if (!response.ok) throw new Error("schedule request failed");
      const data = await response.json() as ScheduleResponse;
      return { date, shows: data.shows };
    }))
      .then((schedules) => {
        if (cancelled) return;
        const next = new Map<string, { show: Show; screening: Screening }>();
        schedules.forEach(({ date, shows }) => shows.forEach((show) => {
          show.screenings.forEach((screening) => next.set(
            favoriteKey(show.canonicalTitle, date, screening.time, show.cinema, screening, show.source),
            { show, screening },
          ));
        }));
        setShowsByFavorite(next);
      })
      .catch(() => { if (!cancelled) setShowsByFavorite(new Map()); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dateKey, films.length]);

  const copyLink = async () => {
    try {
      const url = new URL(`/${locale}/favorites/`, window.location.origin);
      url.searchParams.set("list", encodeSharedFavorites(favorites));
      await navigator.clipboard.writeText(url.toString());
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="mb-8 border-b border-border pb-8">
        <p className="mb-3 text-xs font-medium text-primary">{isShared ? t.favorites.sharedDescription : t.favorites.eyebrow}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-5xl">{isShared ? t.favorites.sharedTitle : t.favorites.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{isShared ? t.favorites.sharedDescription : t.favorites.description}</p>
      </section>

      {!isShared && films.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={copyLink}><RiShareLine aria-hidden="true" />{t.favorites.copyLink}</Button>
          <Button type="button" variant="outline" onClick={onClear}>{t.favorites.clear}</Button>
          {copyStatus !== "idle" && <span role="status" className="text-sm text-muted-foreground">{copyStatus === "copied" ? t.favorites.copied : t.favorites.copyFailed}</span>}
        </div>
      )}

      {invalidLink ? (
        <EmptyState locale={locale} message={t.favorites.invalid} />
      ) : films.length === 0 ? (
        <EmptyState locale={locale} message={t.favorites.emptyDescription} />
      ) : loading ? (
        <div className="grid min-h-64 place-items-center"><Spinner className="size-5 text-primary" /></div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {films.map((film) => {
            const key = favoriteFilmKey(film);
            const match = showsByFavorite.get(key);
            const poster = film.poster ?? match?.show.poster;
            const ticketLink = film.link ?? match?.screening.link ?? match?.show.link;
            return (
              <article key={key} className="h-full">
                <Card className="relative h-full overflow-hidden sm:grid sm:grid-cols-[8rem_1fr]">
                  {poster ? <img src={poster} alt="" loading="lazy" className="h-48 w-full object-cover sm:h-full" /> : <div className="grid min-h-48 place-items-center bg-muted text-muted-foreground"><RiStarLine size={24} aria-hidden="true" /></div>}
                  <CardContent className="flex min-w-0 flex-col py-5">
                    {!isShared && <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(film)} aria-label={t.favorites.remove} title={t.favorites.remove} className="absolute right-3 top-3 text-primary"><RiStarFill aria-hidden="true" /></Button>}
                    <CardHeader className="p-0">
                      <CardTitle className="pr-10 text-lg leading-snug">{film.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">{t.favorites.date}: {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(`${film.date}T12:00:00`))}</p>
                    </CardHeader>
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-sm font-medium">{film.cinema}</p>
                      <Badge className="mt-2">{film.time}</Badge>
                      <span className="mt-2 block"><ScreeningBadges locale={locale} screening={film} /></span>
                      <div className="mt-5 flex flex-wrap gap-3 text-sm">
                        <a href={`/${locale}/film/${filmSlug(film.title)}/?date=${film.date}`} className="inline-flex items-center gap-1 font-medium text-primary hover:text-foreground">{t.filmPage.allScreenings} <span aria-hidden="true">→</span></a>
                        {ticketLink && <a href={ticketLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:text-foreground">{t.shows.buyTickets} <RiExternalLinkLine size={15} aria-hidden="true" /></a>}
                      </div>
                      {!match && !ticketLink && <p className="mt-3 text-sm text-muted-foreground">{t.favorites.unavailable}</p>}
                    </div>
                  </CardContent>
                </Card>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ locale, message }: { locale: Locale; message: string }) {
  const t = translations[locale].favorites;
  return (
    <Empty className="min-h-72 border border-dashed border-border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon"><RiStarLine className="size-4" aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>{t.empty}</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <a href={`/${locale}/`} className={buttonVariants()}>{t.browse}</a>
    </Empty>
  );
}
