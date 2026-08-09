import { useEffect, useState } from "react";
import { translations, type Locale } from "../i18n/translations";
import { decodeSharedFavorites, encodeSharedFavorites, favoriteKey, type FavoriteFilm } from "../lib/favorites";
import type { Show } from "../lib/normalize";

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
  const [showsByFavorite, setShowsByFavorite] = useState<Map<string, Show>>(new Map());
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
        const next = new Map<string, Show>();
        schedules.forEach(({ date, shows }) => shows.forEach((show) => {
          show.times.forEach((time) => next.set(favoriteKey(show.title, date, time, show.cinema), show));
        }));
        setShowsByFavorite(next);
      })
      .catch(() => { if (!cancelled) setShowsByFavorite(new Map()); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dates, films.length]);

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
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <section className="mb-8 border-b border-white/8 pb-8">
        <p className="mb-3 text-[10px] tracking-[0.3em] text-retro-magenta uppercase">{isShared ? t.favorites.sharedDescription : t.favorites.eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">{isShared ? t.favorites.sharedTitle : t.favorites.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-500">{isShared ? t.favorites.sharedDescription : t.favorites.description}</p>
      </section>

      {!isShared && films.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <button type="button" onClick={copyLink} className="border border-retro-cyan/50 px-4 py-2 text-xs font-bold tracking-widest text-retro-cyan uppercase transition-colors hover:bg-retro-cyan hover:text-black">{t.favorites.copyLink}</button>
          <button type="button" onClick={onClear} className="border border-white/10 px-4 py-2 text-xs tracking-widest text-gray-500 uppercase transition-colors hover:border-retro-magenta hover:text-retro-magenta">{t.favorites.clear}</button>
          {copyStatus !== "idle" && <span role="status" className={`text-xs ${copyStatus === "copied" ? "text-retro-green" : "text-retro-magenta"}`}>{copyStatus === "copied" ? t.favorites.copied : t.favorites.copyFailed}</span>}
        </div>
      )}

      {invalidLink ? (
        <EmptyState locale={locale} message={t.favorites.invalid} />
      ) : films.length === 0 ? (
        <EmptyState locale={locale} message={t.favorites.emptyDescription} />
      ) : loading ? (
        <div className="grid min-h-64 place-items-center"><span className="text-xs tracking-[0.25em] text-retro-cyan uppercase">{t.favorites.loading}</span></div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {films.map((film) => {
            const key = favoriteKey(film.title, film.date, film.time, film.cinema);
            const matchingShow = showsByFavorite.get(key);
            const poster = film.poster ?? matchingShow?.poster;
            const ticketLink = film.link ?? matchingShow?.link;
            return (
              <article key={key} className="relative overflow-hidden border border-white/8 bg-retro-card">
                {!isShared && <button type="button" onClick={() => onRemove(film)} aria-label={t.favorites.remove} title={t.favorites.remove} className="absolute right-3 top-3 z-10 grid size-10 place-items-center border border-retro-yellow bg-retro-bg/90 text-2xl text-retro-yellow backdrop-blur">★</button>}
                <div className="grid h-full sm:grid-cols-[140px_1fr]">
                  {poster ? <img src={poster} alt="" loading="lazy" className="h-44 w-full object-cover opacity-75 sm:h-full" /> : <div className="hidden min-h-48 place-items-center bg-black/30 text-3xl text-gray-800 sm:grid">◇</div>}
                  <div className="p-5">
                    <h2 className="pr-10 text-xl font-bold text-white">{film.title}</h2>
                    <p className="mt-2 text-[10px] tracking-widest text-gray-600 uppercase">{t.favorites.date}: {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(`${film.date}T12:00:00`))}</p>
                    <div className="mt-5 border-t border-white/8 pt-3">
                      <p className="text-xs font-bold tracking-wide text-gray-300">{film.cinema}</p>
                      <span className="mt-2 inline-block border border-retro-yellow/30 bg-retro-yellow/5 px-3 py-1.5 text-sm font-bold text-retro-yellow">{film.time}</span>
                      {ticketLink && <a href={ticketLink} target="_blank" rel="noopener noreferrer" className="mt-3 block text-[10px] font-bold tracking-widest text-retro-green uppercase hover:text-retro-cyan">{t.shows.buyTickets} ↗</a>}
                      {!matchingShow && !ticketLink && <p className="mt-3 text-xs leading-5 text-gray-600">{t.favorites.unavailable}</p>}
                    </div>
                  </div>
                </div>
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
  return <div className="border border-dashed border-white/10 px-4 py-20 text-center"><div className="text-4xl text-retro-yellow">☆</div><h2 className="mt-4 text-sm font-bold tracking-widest text-white uppercase">{t.empty}</h2><p className="mx-auto mt-3 max-w-md text-xs leading-5 text-gray-600">{message}</p><a href={`/${locale}/`} className="mt-6 inline-block border border-retro-cyan/40 px-4 py-2 text-xs font-bold tracking-widest text-retro-cyan uppercase hover:bg-retro-cyan hover:text-black">{t.browse}</a></div>;
}
