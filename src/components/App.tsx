import { useEffect, useState } from "react";
import { countLabel, translations, type Locale } from "../i18n/translations";
import { mergeShowsForDisplay, withScreenings, type Show } from "../lib/normalize";
import { isEnglishFriendly, type Screening } from "../lib/screening-language";
import DateSelector from "./DateSelector";
import ShowFilters, {
  type FilterChip,
  type QuickPreset,
  type SortMode,
  type ViewMode,
} from "./ShowFilters";
import TodayShows from "./TodayShows";
import CinemaJumpNav from "./CinemaJumpNav";
import { groupShows } from "../lib/group-shows";
import { cinemas as cinemaCatalog, type Cinema } from "../data/cinemas";
import { favoriteFilmKey } from "../lib/favorites";
import { useFavorites } from "../lib/useFavorites";
import FavoritesPage from "./FavoritesPage";
import PopularScreenings from "./PopularScreenings";
import type { PopularScreeningItem } from "../lib/popular-screenings";
import { warsawDate, warsawTimeMinutes } from "../lib/warsaw-date";
import { serializeShowFilters, type ShowFilterState } from "../lib/show-filter-params";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  locale: Locale;
  shows: Show[];
  updatedAt: string | null;
  failedCinemas: string[];
  cinema?: Cinema;
  favoritesPage?: boolean;
  initialFilters?: ShowFilterState;
  popularItems?: PopularScreeningItem[];
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

function defaultFilters(today: string): ShowFilterState {
  return {
    date: today,
    query: "",
    cinema: "",
    fromTime: "",
    toTime: "",
    startingSoon: false,
    englishFriendly: false,
    view: "cinema",
    sort: "cinema",
  };
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
  initialFilters,
  popularItems = [],
}: Props) {
  const t = translations[locale];
  const today = warsawDate();
  const seed = initialFilters ?? defaultFilters(today);
  const [selectedDate, setSelectedDate] = useState(seed.date);
  const [shows, setShows] = useState<Show[]>(initialShows);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [failedCinemas, setFailedCinemas] = useState(initialFailedCinemas);
  const [query, setQuery] = useState(seed.query);
  const [deferredQuery, setDeferredQuery] = useState(seed.query);
  const [cinema, setCinema] = useState(seed.cinema);
  const [fromTime, setFromTime] = useState(seed.fromTime);
  const [toTime, setToTime] = useState(seed.toTime);
  const [startingSoon, setStartingSoon] = useState(seed.startingSoon);
  const [englishFriendly, setEnglishFriendly] = useState(seed.englishFriendly);
  const [sort, setSort] = useState<SortMode>(seed.sort);
  const [view, setView] = useState<ViewMode>(seed.view);
  const [activePreset, setActivePreset] = useState<QuickPreset | null>(null);
  const [favoritesNotice, setFavoritesNotice] = useState(false);
  const { favorites, toggle, remove, clear } = useFavorites();
  const favoriteKeys = new Set(favorites.map(favoriteFilmKey));

  useEffect(() => {
    const timer = setTimeout(() => setDeferredQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (favoritesPage) return;
    const params = serializeShowFilters(
      { date: selectedDate, query: deferredQuery, cinema, fromTime, toTime, startingSoon, englishFriendly, view, sort },
      today,
    );
    const suffix = params.size ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${suffix}`);

    const localeSwitch = document.querySelector<HTMLAnchorElement>("[data-locale-switch]");
    if (localeSwitch) localeSwitch.href = `${localeSwitch.pathname}${suffix}`;
  }, [favoritesPage, selectedDate, deferredQuery, cinema, fromTime, toTime, startingSoon, englishFriendly, view, sort, today]);

  const availableShows = lockedCinema ? shows.filter((show) => show.source === lockedCinema.slug) : shows;

  const cinemaNames = cinemaCatalog
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b, locale));

  const filteredShows = (() => {
    const normalizedQuery = normalizeSearch(deferredQuery.trim());
    const from = fromTime ? toMinutes(fromTime) : null;
    const until = toTime ? toMinutes(toTime) : null;
    const nowMinutes = warsawTimeMinutes();
    const soonLimit = nowMinutes + 120;
    const hasScreeningFilter = from !== null || until !== null || startingSoon || englishFriendly;

    const filtered = availableShows.flatMap((show) => {
      if (normalizedQuery && !normalizeSearch(`${show.canonicalTitle} ${show.title} ${show.cinema}`).includes(normalizedQuery)) return [];
      if (cinema && show.cinema !== cinema) return [];
      if (!hasScreeningFilter) return [show];

      const screenings = show.screenings.filter((screening) => {
        const minutes = toMinutes(screening.time);
        if (minutes === null) return false;
        if (from !== null && minutes < from) return false;
        if (until !== null && minutes > until) return false;
        if (startingSoon && (minutes < nowMinutes || minutes > soonLimit)) return false;
        if (englishFriendly && !isEnglishFriendly(screening)) return false;
        return true;
      });

      return screenings.length ? [withScreenings(show, screenings)] : [];
    });

    return filtered.sort((a, b) => {
      if (sort === "title") return a.canonicalTitle.localeCompare(b.canonicalTitle, locale);
      if (sort === "time") {
        const aTime = Math.min(...a.screenings.map((screening) => toMinutes(screening.time) ?? Number.POSITIVE_INFINITY));
        const bTime = Math.min(...b.screenings.map((screening) => toMinutes(screening.time) ?? Number.POSITIVE_INFINITY));
        return aTime - bTime || a.canonicalTitle.localeCompare(b.canonicalTitle, locale);
      }
      return a.cinema.localeCompare(b.cinema, locale) || a.canonicalTitle.localeCompare(b.canonicalTitle, locale);
    });
  })();

  const displayShows = mergeShowsForDisplay(filteredShows);
  const groups = groupShows(displayShows, view, locale);
  const filmCount = new Set(displayShows.map((show) => normalizeSearch(show.canonicalTitle))).size;
  const cinemaCount = lockedCinema ? 1 : cinemaNames.length;
  const relevantFailures = lockedCinema
    ? failedCinemas.filter((name) => name === lockedCinema.label)
    : failedCinemas;

  const resetFilters = () => {
    setQuery("");
    setDeferredQuery("");
    setCinema("");
    setFromTime("");
    setToTime("");
    setStartingSoon(false);
    setEnglishFriendly(false);
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
    if (date === seed.date) {
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

  const clearTimeRange = (which: "from" | "to") => {
    if (which === "from") setFromTime("");
    else setToTime("");
    setActivePreset(null);
  };

  const chips: FilterChip[] = [
    deferredQuery && { key: "query", label: `${t.filters.search}: ${deferredQuery}`, onClear: () => { setQuery(""); setDeferredQuery(""); } },
    cinema && { key: "cinema", label: `${t.filters.cinema}: ${cinema}`, onClear: () => setCinema("") },
    fromTime && { key: "from", label: `${t.filters.from} ${fromTime}`, onClear: () => clearTimeRange("from") },
    toTime && { key: "to", label: `${t.filters.until} ${toTime}`, onClear: () => clearTimeRange("to") },
    startingSoon && { key: "soon", label: t.filters.startingSoon, onClear: () => { setStartingSoon(false); setActivePreset(null); } },
    englishFriendly && { key: "english", label: t.filters.englishFriendly, onClear: () => setEnglishFriendly(false) },
  ].filter(Boolean) as FilterChip[];

  const hasFilters = Boolean(deferredQuery || cinema || fromTime || toTime || startingSoon || englishFriendly);
  const isStale = updatedAt
    ? Date.now() - new Date(updatedAt).getTime() > 6 * 60 * 60 * 1000
    : false;

  if (favoritesPage) {
    return <FavoritesPage locale={locale} favorites={favorites} onRemove={remove} onClear={clear} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {lockedCinema ? lockedCinema.label : t.hero.title} <span className="text-primary">{lockedCinema ? t.cinemaPage.schedule : t.hero.accent}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{filmCount} {countLabel(locale, filmCount, t.hero.films)}</Badge>
          <Badge variant="outline">{cinemaCount} {countLabel(locale, cinemaCount, t.hero.cinemas)}</Badge>
        </div>
      </section>

      <div className="mb-5">
        <DateSelector locale={locale} selected={selectedDate} onChange={handleDateChange} />
      </div>
      {loading ? (
        <div className="grid min-h-72 place-items-center border border-border bg-card">
          <div className="text-center">
            <Spinner className="mx-auto mb-3 size-5 text-primary" />
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          </div>
        </div>
      ) : (
        <>
          {(loadError || relevantFailures.length > 0 || isStale) && (
            <Alert className="mb-4" role="status">
              <AlertDescription>
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
              </AlertDescription>
            </Alert>
          )}
          {favoritesNotice && <Alert className="mb-4" role="status"><AlertDescription>{t.favorites.limit}</AlertDescription></Alert>}
          <ShowFilters
            locale={locale}
            cinemas={cinemaNames}
            query={query}
            cinema={cinema}
            fromTime={fromTime}
            toTime={toTime}
            startingSoon={startingSoon}
            englishFriendly={englishFriendly}
            sort={sort}
            view={view}
            activePreset={activePreset}
            startingSoonAvailable={selectedDate === today}
            resultCount={filmCount}
            hideCinema={Boolean(lockedCinema)}
            chips={chips}
            jumpNav={<CinemaJumpNav locale={locale} groups={groups} />}
            onQueryChange={setQuery}
            onCinemaChange={setCinema}
            onFromTimeChange={(value) => { setFromTime(value); setActivePreset(null); }}
            onToTimeChange={(value) => { setToTime(value); setActivePreset(null); }}
            onStartingSoonChange={(value) => { setStartingSoon(value); setActivePreset(null); }}
            onEnglishFriendlyChange={setEnglishFriendly}
            onSortChange={setSort}
            onViewChange={handleViewChange}
            onPresetChange={applyPreset}
            onReset={resetFilters}
          />
          {!hasFilters && popularItems.length > 0 && (
            <PopularScreenings locale={locale} items={popularItems} selectedDate={selectedDate} />
          )}
          <TodayShows
            locale={locale}
            groups={groups}
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
            onToggleFavorite={(show, screening: Screening) => {
              const result = toggle(show, selectedDate, screening);
              setFavoritesNotice(result === "full");
            }}
            onResetFilters={hasFilters ? resetFilters : undefined}
          />
        </>
      )}
    </div>
  );
}
