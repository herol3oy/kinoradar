import { useEffect, useState } from "react";
import { translations, type Locale } from "../i18n/translations";
import { favoriteFilmKey, favoriteKey } from "../lib/favorites";
import { showsForFilm } from "../lib/film";
import type { Show } from "../lib/normalize";
import type { KinotekaLiveScreening } from "../lib/kinoteka";
import type { MsiLiveScreening } from "../lib/msi";
import { NOVEKINO_CINEMAS, type NovekinoCinema } from "../lib/novekino";
import { screeningIdentity, type Screening, type ScreeningProviderRef } from "../lib/screening-language";
import { useFavorites } from "../lib/useFavorites";
import DateSelector from "./DateSelector";
import ScreeningBadges from "./ScreeningBadges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { RiArrowRightUpLine, RiStarFill, RiStarLine } from "@remixicon/react";

type ScheduleResponse = {
  shows: Show[];
  updatedAt: string | null;
  failedCinemas: string[];
};

type Props = {
  locale: Locale;
  slug: string;
  title: string;
  selectedDate: string;
  shows: Show[];
  failedCinemas: string[];
};

type LiveLookupState =
  | { status: "loading" }
  | { status: "loaded"; data: KinotekaLiveScreening | MsiLiveScreening }
  | { status: "failed" };

function liveScreeningKey(provider: "kinoteka" | "kinokultura" | "novekino", screeningId: string, cinema?: NovekinoCinema): string {
  return provider === "novekino" ? `${provider}:${cinema}:${screeningId}` : `${provider}:${screeningId}`;
}

function providerLiveScreeningKey(providerRef: ScreeningProviderRef): string | undefined {
  if (providerRef.provider === "novekino") {
    return liveScreeningKey("novekino", providerRef.screeningId, providerRef.cinema);
  }
  if (providerRef.provider === "kinoteka" || providerRef.provider === "kinokultura") {
    return liveScreeningKey(providerRef.provider, providerRef.screeningId);
  }
  return undefined;
}

function timeValue(time: string): number {
  const match = time.match(/(?:^|\D)([01]?\d|2[0-3])[:.]([0-5]\d)(?:\D|$)/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.POSITIVE_INFINITY;
}

export default function FilmDetails({ locale, slug, title, selectedDate: initialDate, shows: initialShows, failedCinemas: initialFailures }: Props) {
  const t = translations[locale];
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [shows, setShows] = useState(initialShows);
  const [failedCinemas, setFailedCinemas] = useState(initialFailures);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [liveScreenings, setLiveScreenings] = useState<Record<string, LiveLookupState>>({});
  const [favoritesNotice, setFavoritesNotice] = useState(false);
  const { favorites, toggle } = useFavorites();
  const favoriteKeys = new Set(favorites.map(favoriteFilmKey));
  const kinotekaIds = [...new Set(shows.flatMap((show) => show.screenings.flatMap((screening) =>
    screening.providerRef?.provider === "kinoteka" ? [screening.providerRef.screeningId] : [],
  )))];
  const kinokulturaIds = [...new Set(shows.flatMap((show) => show.screenings.flatMap((screening) =>
    screening.providerRef?.provider === "kinokultura" ? [screening.providerRef.screeningId] : [],
  )))];
  const novekinoIdsByCinema = Object.fromEntries(NOVEKINO_CINEMAS.map((cinema) => [
    cinema,
    [...new Set(shows.flatMap((show) => show.screenings.flatMap((screening) =>
      screening.providerRef?.provider === "novekino" && screening.providerRef.cinema === cinema
        ? [screening.providerRef.screeningId]
        : [],
    )))],
  ])) as Record<NovekinoCinema, string[]>;
  const liveIdsKey = [
    `kinoteka:${kinotekaIds.join(",")}`,
    `kinokultura:${kinokulturaIds.join(",")}`,
    ...NOVEKINO_CINEMAS.map((cinema) => `novekino:${cinema}:${novekinoIdsByCinema[cinema].join(",")}`),
  ].join("|");

  useEffect(() => {
    if (!kinotekaIds.length && !kinokulturaIds.length
      && NOVEKINO_CINEMAS.every((cinema) => !novekinoIdsByCinema[cinema].length)) {
      setLiveScreenings({});
      return;
    }

    const controller = new AbortController();
    let nextIndex = 0;
    setLiveScreenings(Object.fromEntries([
      ...kinotekaIds.map((id) => [liveScreeningKey("kinoteka", id), { status: "loading" as const }]),
      ...kinokulturaIds.map((id) => [liveScreeningKey("kinokultura", id), { status: "loading" as const }]),
      ...NOVEKINO_CINEMAS.flatMap((cinema) => novekinoIdsByCinema[cinema].map((id) => [
        liveScreeningKey("novekino", id, cinema),
        { status: "loading" as const },
      ] as const)),
    ]));

    const kinotekaWorker = async () => {
      while (!controller.signal.aborted) {
        const screeningId = kinotekaIds[nextIndex++];
        if (!screeningId) return;
        const key = liveScreeningKey("kinoteka", screeningId);
        try {
          const response = await fetch(`/api/kinoteka/screening/${encodeURIComponent(screeningId)}.json`, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw new Error("live screening request failed");
          const data = await response.json() as KinotekaLiveScreening;
          if (data.screeningId !== screeningId || !Array.isArray(data.offers)) throw new Error("invalid live screening response");
          if (!controller.signal.aborted) {
            setLiveScreenings((current) => ({ ...current, [key]: { status: "loaded", data } }));
          }
        } catch (error) {
          if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
            setLiveScreenings((current) => ({ ...current, [key]: { status: "failed" } }));
          }
        }
      }
    };

    const loadNovekino = async (cinema: NovekinoCinema) => {
      const ids = novekinoIdsByCinema[cinema];
      if (!ids.length) return;
      try {
        const response = await fetch(`/api/novekino/screenings.json?cinema=${cinema}&ids=${encodeURIComponent(ids.join(","))}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("live screening request failed");
        const data = await response.json() as MsiLiveScreening[];
        if (!Array.isArray(data)) throw new Error("invalid live screening response");
        const byId = new Map(data.map((screening) => [screening.screeningId, screening]));
        if (!controller.signal.aborted) {
          setLiveScreenings((current) => {
            const next = { ...current };
            ids.forEach((id) => {
              const screening = byId.get(id);
              next[liveScreeningKey("novekino", id, cinema)] = screening
                ? { status: "loaded", data: screening }
                : { status: "failed" };
            });
            return next;
          });
        }
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setLiveScreenings((current) => {
            const next = { ...current };
            ids.forEach((id) => { next[liveScreeningKey("novekino", id, cinema)] = { status: "failed" }; });
            return next;
          });
        }
      }
    };

    const loadKinokultura = async () => {
      if (!kinokulturaIds.length) return;
      try {
        const response = await fetch(`/api/kinokultura/screenings.json?ids=${encodeURIComponent(kinokulturaIds.join(","))}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("live screening request failed");
        const data = await response.json() as MsiLiveScreening[];
        if (!Array.isArray(data)) throw new Error("invalid live screening response");
        const byId = new Map(data.map((screening) => [screening.screeningId, screening]));
        if (!controller.signal.aborted) {
          setLiveScreenings((current) => {
            const next = { ...current };
            kinokulturaIds.forEach((id) => {
              const screening = byId.get(id);
              next[liveScreeningKey("kinokultura", id)] = screening
                ? { status: "loaded", data: screening }
                : { status: "failed" };
            });
            return next;
          });
        }
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setLiveScreenings((current) => {
            const next = { ...current };
            kinokulturaIds.forEach((id) => { next[liveScreeningKey("kinokultura", id)] = { status: "failed" }; });
            return next;
          });
        }
      }
    };

    void Promise.all([
      ...Array.from({ length: Math.min(4, kinotekaIds.length) }, kinotekaWorker),
      ...NOVEKINO_CINEMAS.map(loadNovekino),
      loadKinokultura(),
    ]);
    return () => controller.abort();
  }, [liveIdsKey]);

  const groups = new Map<string, Array<{ screening: Screening; show: Show }>>();
  shows.forEach((show) => {
    const entries = groups.get(show.cinema) ?? [];
    show.screenings.forEach((screening) => {
      const identity = screeningIdentity(screening);
      if (!entries.some((entry) => screeningIdentity(entry.screening) === identity)) entries.push({ screening, show });
    });
    entries.sort((a, b) => timeValue(a.screening.time) - timeValue(b.screening.time) || screeningIdentity(a.screening).localeCompare(screeningIdentity(b.screening)));
    groups.set(show.cinema, entries);
  });
  const cinemaGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, locale));
  const poster = shows.find((show) => show.poster)?.poster;

  const changeDate = async (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    setLoadError(false);
    setFavoritesNotice(false);
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    window.history.replaceState({}, "", url);
    try {
      const response = await fetch(`/api/today.json?date=${encodeURIComponent(date)}&meta=1`);
      if (!response.ok) throw new Error("schedule request failed");
      const data = await response.json() as ScheduleResponse;
      setShows(showsForFilm(data.shows, slug));
      setFailedCinemas(data.failedCinemas);
    } catch {
      setShows([]);
      setFailedCinemas([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="mb-8 grid gap-6 border-b border-border pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="mb-3 text-xs font-medium text-primary">{t.filmPage.eyebrow}</p>
          <h1 className="max-w-4xl font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{t.filmPage.description}</p>
        </div>
        {poster && <img src={poster} alt="" className="hidden h-32 w-24 border border-border object-cover md:block" />}
      </section>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold">{t.date.heading}</h2>
          <span className="text-xs text-muted-foreground">{t.date.range}</span>
        </div>
        <DateSelector locale={locale} selected={selectedDate} onChange={changeDate} />
      </div>

      {favoritesNotice && <Alert className="mb-4" role="status"><AlertDescription>{t.favorites.limit}</AlertDescription></Alert>}
      {failedCinemas.length > 0 && <Alert className="mb-4" role="status"><AlertDescription>{t.filmPage.partialResults}</AlertDescription></Alert>}

      {loading ? (
        <div className="grid min-h-72 place-items-center border border-border bg-card"><Spinner className="size-5 text-primary" /></div>
      ) : loadError ? (
        <FilmEmpty message={t.filmPage.loadFailed} title={t.filmPage.noScreenings} />
      ) : cinemaGroups.length === 0 ? (
        <FilmEmpty message={t.filmPage.noScreeningsDescription} title={t.filmPage.noScreenings} />
      ) : (
        <section aria-label={t.filmPage.cinemas} className="grid gap-4 md:grid-cols-2">
          {cinemaGroups.map(([cinema, entries]) => (
            <article key={cinema}>
              <Card className="h-full">
              <CardHeader><CardTitle className="text-lg">{cinema}</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {entries.map(({ screening, show }) => {
                  const selected = favoriteKeys.has(favoriteKey(show.canonicalTitle, selectedDate, screening.time, show.cinema, screening, show.source));
                  const liveKey = screening.providerRef
                    ? providerLiveScreeningKey(screening.providerRef)
                    : undefined;
                  return <div key={screeningIdentity(screening)} className="space-y-1">
                    <div className="flex items-center border border-border bg-muted">
                      <Button type="button" size="sm" variant={selected ? "default" : "secondary"} aria-pressed={selected} aria-label={`${selected ? t.favorites.remove : t.favorites.add}: ${show.canonicalTitle}, ${cinema}, ${screening.time}`} onClick={() => { const result = toggle(show, selectedDate, screening); setFavoritesNotice(result === "full"); }} className="h-8 gap-1.5 rounded-none px-2">
                        {selected ? <RiStarFill aria-hidden="true" /> : <RiStarLine aria-hidden="true" />} {screening.time}
                      </Button>
                      {screening.link && <a href={screening.link} target="_blank" rel="noopener noreferrer" aria-label={`${t.shows.buyTickets}: ${show.canonicalTitle}, ${cinema}, ${screening.time}`} className="grid size-8 place-items-center border-l border-border text-muted-foreground hover:text-primary"><RiArrowRightUpLine size={16} aria-hidden="true" /></a>}
                    </div>
                    <ScreeningBadges locale={locale} screening={screening} />
                    <ScreeningLiveDetails
                      locale={locale}
                      screening={screening}
                      state={liveKey ? liveScreenings[liveKey] : undefined}
                    />
                  </div>;
                })}
              </CardContent>
              </Card>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function ScreeningLiveDetails({ locale, screening, state }: { locale: Locale; screening: Screening; state?: LiveLookupState }) {
  if (screening.providerRef?.provider === "novekino" || screening.providerRef?.provider === "kinokultura") {
    return <MsiLiveDetails locale={locale} state={state} />;
  }
  if (screening.providerRef?.provider !== "kinoteka") return null;
  const t = translations[locale].ticketAvailability;

  if (!state || state.status === "loading") {
    return <p className="max-w-44 text-xs leading-4 text-muted-foreground">{t.loading}…</p>;
  }
  if (state.status === "failed") {
    return <p className="text-xs text-muted-foreground">{t.priceUnavailable}</p>;
  }

  const data = state.data as KinotekaLiveScreening;
  const price = (value: number) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: data.currency,
  }).format(value);
  const booked = data.booked !== null ? `${t.booked}: ${data.booked}` : null;
  const priceSummary = data.soldOut
    ? t.soldOut
    : data.fromPrice !== null
      ? `${t.from} ${price(data.fromPrice)}`
      : t.priceUnavailable;

  if (!data.offers.length) {
    return <p className="max-w-48 text-xs leading-4 text-muted-foreground">
      {[priceSummary, booked].filter(Boolean).join(" · ")}
    </p>;
  }

  return (
    <details className="group max-w-56 text-xs leading-4">
      <summary className="cursor-pointer list-none text-primary marker:hidden hover:text-foreground">
        {[priceSummary, booked].filter(Boolean).join(" · ")} <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="mt-1.5 border-l border-border pl-2" aria-label={t.prices}>
        {data.offers.map((offer) => (
          <div key={`${offer.id}:${offer.price}`} className="flex justify-between gap-4 text-muted-foreground">
            <span>{offer.name}</span><span className="shrink-0 text-foreground">{price(offer.price)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function MsiLiveDetails({ locale, state }: { locale: Locale; state?: LiveLookupState }) {
  const t = translations[locale].ticketAvailability;
  if (!state || state.status === "loading") {
    return <p className="max-w-44 text-xs leading-4 text-muted-foreground">{t.checkingAvailability}…</p>;
  }
  if (state.status === "failed") {
    return <p className="text-xs text-muted-foreground">{t.availabilityUnavailable}</p>;
  }

  const data = state.data as MsiLiveScreening;
  const summary = data.soldOut
    ? t.soldOut
    : !data.saleEnabled
      ? t.saleUnavailable
      : data.seatsLeft !== null
        ? `${data.seatsLeft} ${t.seatsAvailable}`
        : t.availabilityUnavailable;
  return <p className="max-w-48 text-xs leading-4 text-muted-foreground">
    {summary}
  </p>;
}

function FilmEmpty({ title, message }: { title: string; message: string }) {
  return (
    <EmptyState title={title} message={message} />
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Empty className="min-h-72 border border-dashed border-border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon"><RiStarLine className="size-4" aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
