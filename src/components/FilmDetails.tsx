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
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <section className="mb-8 grid gap-6 border-b border-white/8 pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="mb-3 text-[10px] tracking-[0.3em] text-retro-magenta uppercase">{t.filmPage.eyebrow}</p>
          <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-500">{t.filmPage.description}</p>
        </div>
        {poster && <img src={poster} alt="" className="hidden h-28 w-44 border border-white/10 object-cover opacity-70 md:block" />}
      </section>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.22em] text-gray-400 uppercase">{t.date.heading}</h2>
          <span className="text-[10px] tracking-widest text-gray-700 uppercase">{t.date.range}</span>
        </div>
        <DateSelector locale={locale} selected={selectedDate} onChange={changeDate} />
      </div>

      {favoritesNotice && <aside className="mb-4 border border-retro-yellow/30 bg-retro-yellow/5 px-4 py-3 text-xs text-retro-yellow" role="status">{t.favorites.limit}</aside>}
      {failedCinemas.length > 0 && <aside className="mb-4 border border-retro-yellow/30 bg-retro-yellow/5 px-4 py-3 text-xs text-retro-yellow" role="status">{t.filmPage.partialResults}</aside>}

      {loading ? (
        <div className="grid min-h-72 place-items-center border border-white/8"><span className="text-xs tracking-[0.25em] text-retro-cyan uppercase">{t.loading}</span></div>
      ) : loadError ? (
        <Empty message={t.filmPage.loadFailed} title={t.filmPage.noScreenings} />
      ) : cinemaGroups.length === 0 ? (
        <Empty message={t.filmPage.noScreeningsDescription} title={t.filmPage.noScreenings} />
      ) : (
        <section aria-label={t.filmPage.cinemas} className="grid gap-4 md:grid-cols-2">
          {cinemaGroups.map(([cinema, entries]) => (
            <article key={cinema} className="border border-white/8 bg-retro-card p-5">
              <h2 className="text-lg font-bold text-white">{cinema}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {entries.map(({ screening, show }) => {
                  const selected = favoriteKeys.has(favoriteKey(show.canonicalTitle, selectedDate, screening.time, show.cinema, screening, show.source));
                  const liveKey = screening.providerRef
                    ? providerLiveScreeningKey(screening.providerRef)
                    : undefined;
                  return <div key={screeningIdentity(screening)} className="space-y-1">
                    <div className={`flex items-center border ${selected ? "border-retro-yellow bg-retro-yellow/10" : "border-white/10"}`}>
                      <button type="button" aria-pressed={selected} aria-label={`${selected ? t.favorites.remove : t.favorites.add}: ${show.canonicalTitle}, ${cinema}, ${screening.time}`} onClick={() => { const result = toggle(show, selectedDate, screening); setFavoritesNotice(result === "full"); }} className={`px-2.5 py-2 text-lg ${selected ? "text-retro-yellow" : "text-gray-500 hover:text-retro-yellow"}`}><span aria-hidden="true">{selected ? "★" : "☆"}</span></button>
                      <span className="pr-2.5 text-sm font-bold text-retro-yellow">{screening.time}</span>
                      {screening.link && <a href={screening.link} target="_blank" rel="noopener noreferrer" aria-label={`${t.shows.buyTickets}: ${show.canonicalTitle}, ${cinema}, ${screening.time}`} className="border-l border-white/10 px-2.5 py-2 text-xs text-retro-green hover:text-retro-cyan">↗</a>}
                    </div>
                    <ScreeningBadges locale={locale} screening={screening} />
                    <ScreeningLiveDetails
                      locale={locale}
                      screening={screening}
                      state={liveKey ? liveScreenings[liveKey] : undefined}
                    />
                  </div>;
                })}
              </div>
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
    return <p className="max-w-44 text-[9px] leading-4 tracking-wide text-gray-600">{t.loading}…</p>;
  }
  if (state.status === "failed") {
    return <p className="text-[9px] tracking-wide text-gray-600">{t.priceUnavailable}</p>;
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
    return <p className={`max-w-48 text-[9px] leading-4 tracking-wide ${data.soldOut ? "text-retro-magenta" : "text-gray-600"}`}>
      {[priceSummary, booked].filter(Boolean).join(" · ")}
    </p>;
  }

  return (
    <details className="group max-w-56 text-[9px] leading-4">
      <summary className="cursor-pointer list-none tracking-wide text-retro-cyan marker:hidden hover:text-white">
        {[priceSummary, booked].filter(Boolean).join(" · ")} <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="mt-1.5 border-l border-white/10 pl-2" aria-label={t.prices}>
        {data.offers.map((offer) => (
          <div key={`${offer.id}:${offer.price}`} className="flex justify-between gap-4 text-gray-500">
            <span>{offer.name}</span><span className="shrink-0 text-gray-300">{price(offer.price)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function MsiLiveDetails({ locale, state }: { locale: Locale; state?: LiveLookupState }) {
  const t = translations[locale].ticketAvailability;
  if (!state || state.status === "loading") {
    return <p className="max-w-44 text-[9px] leading-4 tracking-wide text-gray-600">{t.checkingAvailability}…</p>;
  }
  if (state.status === "failed") {
    return <p className="text-[9px] tracking-wide text-gray-600">{t.availabilityUnavailable}</p>;
  }

  const data = state.data as MsiLiveScreening;
  const summary = data.soldOut
    ? t.soldOut
    : !data.saleEnabled
      ? t.saleUnavailable
      : data.seatsLeft !== null
        ? `${data.seatsLeft} ${t.seatsAvailable}`
        : t.availabilityUnavailable;
  return <p className={`max-w-48 text-[9px] leading-4 tracking-wide ${data.soldOut ? "text-retro-magenta" : "text-retro-cyan"}`}>
    {summary}
  </p>;
}

function Empty({ title, message }: { title: string; message: string }) {
  return <div className="border border-dashed border-white/10 px-4 py-20 text-center"><span className="text-3xl text-retro-yellow">∅</span><h2 className="mt-4 text-sm font-bold tracking-widest text-white uppercase">{title}</h2><p className="mx-auto mt-3 max-w-md text-xs leading-5 text-gray-600">{message}</p></div>;
}
