import { useState } from "react";
import { translations, type Locale } from "../i18n/translations";
import { favoriteKey } from "../lib/favorites";
import { showsForFilm } from "../lib/film";
import type { Show } from "../lib/normalize";
import { useFavorites } from "../lib/useFavorites";
import DateSelector from "./DateSelector";

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
  const [favoritesNotice, setFavoritesNotice] = useState(false);
  const { favorites, toggle } = useFavorites();
  const favoriteKeys = new Set(favorites.map((film) => favoriteKey(film.title, film.date, film.time, film.cinema)));

  const groups = new Map<string, Array<{ time: string; show: Show }>>();
  shows.forEach((show) => {
    const entries = groups.get(show.cinema) ?? [];
    show.times.forEach((time) => {
      if (!entries.some((entry) => entry.time === time)) entries.push({ time, show });
    });
    entries.sort((a, b) => timeValue(a.time) - timeValue(b.time) || a.time.localeCompare(b.time));
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
                {entries.map(({ time, show }) => {
                  const selected = favoriteKeys.has(favoriteKey(show.title, selectedDate, time, show.cinema));
                  return <div key={time} className={`flex items-center border ${selected ? "border-retro-yellow bg-retro-yellow/10" : "border-white/10"}`}>
                    <button type="button" aria-pressed={selected} aria-label={`${selected ? t.favorites.remove : t.favorites.add}: ${show.title}, ${cinema}, ${time}`} onClick={() => { const result = toggle(show, selectedDate, time); setFavoritesNotice(result === "full"); }} className={`px-2.5 py-2 text-lg ${selected ? "text-retro-yellow" : "text-gray-500 hover:text-retro-yellow"}`}><span aria-hidden="true">{selected ? "★" : "☆"}</span></button>
                    <span className="pr-2.5 text-sm font-bold text-retro-yellow">{time}</span>
                    {show.link && <a href={show.link} target="_blank" rel="noopener noreferrer" aria-label={`${t.shows.buyTickets}: ${show.title}, ${cinema}, ${time}`} className="border-l border-white/10 px-2.5 py-2 text-xs text-retro-green hover:text-retro-cyan">↗</a>}
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

function Empty({ title, message }: { title: string; message: string }) {
  return <div className="border border-dashed border-white/10 px-4 py-20 text-center"><span className="text-3xl text-retro-yellow">∅</span><h2 className="mt-4 text-sm font-bold tracking-widest text-white uppercase">{title}</h2><p className="mx-auto mt-3 max-w-md text-xs leading-5 text-gray-600">{message}</p></div>;
}
