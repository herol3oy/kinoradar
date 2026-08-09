import { useState } from "react";
import { countLabel, translations, type Locale } from "../i18n/translations";
import type { Show } from "../lib/normalize";
import DateSelector from "./DateSelector";
import ShowFilters, {
  type QuickPreset,
  type SortMode,
  type ViewMode,
} from "./ShowFilters";
import TodayShows from "./TodayShows";
import type { Cinema } from "../data/cinemas";
import { favoriteKey } from "../lib/favorites";
import { useFavorites } from "../lib/useFavorites";
import FavoritesPage from "./FavoritesPage";
import { warsawDate, warsawTimeMinutes } from "../lib/warsaw-date";

interface Props {
  locale: Locale;
  shows: Show[];
  updatedAt: string | null;
  failedCinemas: string[];
  cinema?: Cinema;
  favoritesPage?: boolean;
}

type ScheduleResponse = {
  shows: Show[];
  updatedAt: string | null;
  failedCinemas: string[];
};

function toMinutes(value: string): number | null {
  const match = value.match(/(?:^|\D)([01]?\d|2[0-3])[:.]([0-5]\d)(?:\D|$)/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl");
}

export default function App({
  locale,
  shows: initialShows,
  updatedAt: initialUpdatedAt,
  failedCinemas: initialFailedCinemas,
  cinema: lockedCinema,
  favoritesPage = false,
}: Props) {
  const t = translations[locale];
  const today = warsawDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [shows, setShows] = useState<Show[]>(initialShows);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [failedCinemas, setFailedCinemas] = useState(initialFailedCinemas);
  const [query, setQuery] = useState("");
  const [cinema, setCinema] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [startingSoon, setStartingSoon] = useState(false);
  const [sort, setSort] = useState<SortMode>("cinema");
  const [view, setView] = useState<ViewMode>("cinema");
  const [activePreset, setActivePreset] = useState<QuickPreset | null>(null);
  const [favoritesNotice, setFavoritesNotice] = useState(false);
  const { favorites, toggle, remove, clear } = useFavorites();
  const favoriteKeys = new Set(favorites.map((film) => favoriteKey(film.title, film.date, film.time, film.cinema)));

  const availableShows = lockedCinema ? shows.filter((show) => show.source === lockedCinema.slug) : shows;

  const cinemas = [...new Set(availableShows.map((show) => show.cinema))].sort((a, b) => a.localeCompare(b, locale));

  const filteredShows = (() => {
    const normalizedQuery = normalizeSearch(query.trim());
    const from = fromTime ? toMinutes(fromTime) : null;
    const until = toTime ? toMinutes(toTime) : null;
    const nowMinutes = warsawTimeMinutes();
    const soonLimit = nowMinutes + 120;
    const hasTimeFilter = from !== null || until !== null || startingSoon;

    const filtered = availableShows.flatMap((show) => {
      if (normalizedQuery && !normalizeSearch(show.title).includes(normalizedQuery)) return [];
      if (cinema && show.cinema !== cinema) return [];
      if (!hasTimeFilter) return [show];

      const times = show.times.filter((time) => {
        const minutes = toMinutes(time);
        if (minutes === null) return false;
        if (from !== null && minutes < from) return false;
        if (until !== null && minutes > until) return false;
        if (startingSoon && (minutes < nowMinutes || minutes > soonLimit)) return false;
        return true;
      });

      return times.length ? [{ ...show, times }] : [];
    });

    return filtered.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, locale);
      if (sort === "time") {
        const aTime = Math.min(...a.times.map((time) => toMinutes(time) ?? Number.POSITIVE_INFINITY));
        const bTime = Math.min(...b.times.map((time) => toMinutes(time) ?? Number.POSITIVE_INFINITY));
        return aTime - bTime || a.title.localeCompare(b.title, locale);
      }
      return a.cinema.localeCompare(b.cinema, locale) || a.title.localeCompare(b.title, locale);
    });
  })();

  const filmCount = new Set(filteredShows.map((show) => normalizeSearch(show.title.trim()))).size;
  const cinemaCount = lockedCinema ? 1 : cinemas.length;
  const relevantFailures = lockedCinema
    ? failedCinemas.filter((name) => name === lockedCinema.label)
    : failedCinemas;

  const resetFilters = () => {
    setQuery("");
    setCinema("");
    setFromTime("");
    setToTime("");
    setStartingSoon(false);
    setSort("cinema");
    setActivePreset(null);
  };

  const applyPreset = (preset: QuickPreset) => {
    setActivePreset(preset);
    setStartingSoon(preset === "now");
    if (preset === "after-work") {
      setFromTime("17:00");
      setToTime("21:00");
    } else if (preset === "tonight") {
      setFromTime("18:00");
      setToTime("23:59");
    } else {
      setFromTime("");
      setToTime("");
    }
  };

  const handleViewChange = (nextView: ViewMode) => {
    setView(nextView);
    if (nextView === "film" && sort === "cinema") setSort("title");
  };

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setCinema("");
    setStartingSoon(false);
    setActivePreset(null);
    setLoadError(false);
    if (date === today) {
      setShows(initialShows);
      setUpdatedAt(initialUpdatedAt);
      setFailedCinemas(initialFailedCinemas);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/today.json?date=${date}&meta=1`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as ScheduleResponse;
      setShows(data.shows);
      setUpdatedAt(data.updatedAt);
      setFailedCinemas(data.failedCinemas);
    } catch {
      setShows([]);
      setUpdatedAt(null);
      setFailedCinemas([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const hasFilters = Boolean(query || cinema || fromTime || toTime || startingSoon);
  const isStale = updatedAt
    ? Date.now() - new Date(updatedAt).getTime() > 6 * 60 * 60 * 1000
    : false;

  if (favoritesPage) {
    return <FavoritesPage locale={locale} favorites={favorites} onRemove={remove} onClear={clear} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <section className="mb-8 grid gap-6 border-b border-white/8 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-3 text-[10px] tracking-[0.3em] text-retro-magenta uppercase">{lockedCinema ? t.cinemaPage.eyebrow : t.hero.eyebrow}</p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            {lockedCinema ? lockedCinema.label : t.hero.title} <span className="text-retro-cyan [text-shadow:0_0_24px_rgba(0,255,255,0.3)]">{lockedCinema ? t.cinemaPage.schedule : t.hero.accent}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-500">
            {lockedCinema ? t.cinemaPage.description : t.hero.description}
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <span className="block text-2xl font-bold text-white">{filmCount}</span>
            <span className="text-[9px] tracking-[0.2em] text-gray-600 uppercase">{countLabel(locale, filmCount, t.hero.films)}</span>
          </div>
          <div>
            <span className="block text-2xl font-bold text-white">{cinemaCount}</span>
            <span className="text-[9px] tracking-[0.2em] text-gray-600 uppercase">{countLabel(locale, cinemaCount, t.hero.cinemas)}</span>
          </div>
        </div>
      </section>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.22em] text-gray-400 uppercase">{t.date.heading}</h2>
          <span className="text-[10px] tracking-widest text-gray-700 uppercase">{t.date.range}</span>
        </div>
        <DateSelector locale={locale} selected={selectedDate} onChange={handleDateChange} />
      </div>
      {loading ? (
        <div className="grid min-h-72 place-items-center border border-white/8 bg-white/[0.015]">
          <div className="text-center">
            <span className="mx-auto mb-4 block size-8 animate-spin rounded-full border border-retro-cyan/20 border-t-retro-cyan" />
            <p className="text-xs tracking-[0.25em] text-retro-cyan uppercase">{t.loading}</p>
          </div>
        </div>
      ) : (
        <>
          {(loadError || relevantFailures.length > 0 || isStale) && (
            <aside className="mb-4 border border-retro-yellow/30 bg-retro-yellow/5 px-4 py-3 text-xs leading-5 tracking-wider text-retro-yellow uppercase" role="status">
              {loadError ? (
                <span>{t.status.loadFailed}</span>
              ) : relevantFailures.length > 0 ? (
                <span>
                  {availableShows.length === 0 ? t.status.updateFailed : t.status.partialResults} — {t.status.couldNotUpdate}: {relevantFailures.join(", ")}.
                  {updatedAt && ` ${t.status.lastAttempt}: ${new Date(updatedAt).toLocaleString(locale)}.`}
                </span>
              ) : (
                <span>
                  {t.status.staleResults} {new Date(updatedAt!).toLocaleString(locale)}.
                </span>
              )}
            </aside>
          )}
          {favoritesNotice && <aside className="mb-4 border border-retro-yellow/30 bg-retro-yellow/5 px-4 py-3 text-xs text-retro-yellow" role="status">{t.favorites.limit}</aside>}
          <ShowFilters
            locale={locale}
            cinemas={cinemas}
            query={query}
            cinema={cinema}
            fromTime={fromTime}
            toTime={toTime}
            startingSoon={startingSoon}
            sort={sort}
            view={view}
            activePreset={activePreset}
            startingSoonAvailable={selectedDate === today}
            resultCount={filmCount}
            hideCinema={Boolean(lockedCinema)}
            onQueryChange={setQuery}
            onCinemaChange={setCinema}
            onFromTimeChange={(value) => { setFromTime(value); setActivePreset(null); }}
            onToTimeChange={(value) => { setToTime(value); setActivePreset(null); }}
            onStartingSoonChange={(value) => { setStartingSoon(value); setActivePreset(null); }}
            onSortChange={setSort}
            onViewChange={handleViewChange}
            onPresetChange={applyPreset}
            onReset={resetFilters}
          />
          <TodayShows
            locale={locale}
            shows={filteredShows}
            view={view}
            emptyMessage={
              loadError
                ? t.shows.loadFailed
                : availableShows.length === 0
                  ? t.shows.nonePublished
                  : hasFilters
                    ? t.shows.noMatches
                    : t.shows.noneAvailable
            }
            selectedDate={selectedDate}
            favoriteKeys={favoriteKeys}
            onToggleFavorite={(show, time) => {
              const result = toggle(show, selectedDate, time);
              setFavoritesNotice(result === "full");
            }}
          />
        </>
      )}
    </div>
  );
}
