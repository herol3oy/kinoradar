import { useMemo, useState } from "react";
import type { Show } from "../lib/normalize";
import DateSelector from "./DateSelector";
import ShowFilters, {
  type QuickPreset,
  type SortMode,
  type ViewMode,
} from "./ShowFilters";
import TodayShows from "./TodayShows";

interface Props {
  shows: Show[];
  updatedAt: string | null;
  failedCinemas: string[];
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
  shows: initialShows,
  updatedAt: initialUpdatedAt,
  failedCinemas: initialFailedCinemas,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
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

  const cinemas = useMemo(
    () => [...new Set(shows.map((show) => show.cinema))].sort((a, b) => a.localeCompare(b, "pl")),
    [shows],
  );

  const filteredShows = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    const from = fromTime ? toMinutes(fromTime) : null;
    const until = toTime ? toMinutes(toTime) : null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const soonLimit = nowMinutes + 120;
    const hasTimeFilter = from !== null || until !== null || startingSoon;

    const filtered = shows.flatMap((show) => {
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
      if (sort === "title") return a.title.localeCompare(b.title, "pl");
      if (sort === "time") {
        const aTime = Math.min(...a.times.map((time) => toMinutes(time) ?? Number.POSITIVE_INFINITY));
        const bTime = Math.min(...b.times.map((time) => toMinutes(time) ?? Number.POSITIVE_INFINITY));
        return aTime - bTime || a.title.localeCompare(b.title, "pl");
      }
      return a.cinema.localeCompare(b.cinema, "pl") || a.title.localeCompare(b.title, "pl");
    });
  }, [cinema, fromTime, query, shows, sort, startingSoon, toTime]);

  const filmCount = useMemo(
    () => new Set(filteredShows.map((show) => normalizeSearch(show.title.trim()))).size,
    [filteredShows],
  );

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

  return (
    <div className="px-3">
      <DateSelector selected={selectedDate} onChange={handleDateChange} />
      {loading ? (
        <p className="text-retro-cyan text-sm tracking-widest animate-pulse">
          _LOADING...
        </p>
      ) : (
        <>
          {(loadError || failedCinemas.length > 0 || isStale) && (
            <aside className="mb-4 border border-retro-yellow bg-retro-surface px-3 py-2 text-xs tracking-wider text-retro-yellow uppercase" role="status">
              {loadError ? (
                <span>_SCHEDULE_LOAD_FAILED — PLEASE TRY ANOTHER DATE OR REFRESH.</span>
              ) : failedCinemas.length > 0 ? (
                <span>
                  {shows.length === 0 ? "_SCHEDULE_UPDATE_FAILED" : "_PARTIAL_RESULTS"} — COULD NOT UPDATE: {failedCinemas.join(", ")}.
                  {updatedAt && ` LAST ATTEMPT: ${new Date(updatedAt).toLocaleString("pl-PL")}.`}
                </span>
              ) : (
                <span>
                  _STALE_RESULTS — LAST UPDATED {new Date(updatedAt!).toLocaleString("pl-PL")}.
                </span>
              )}
            </aside>
          )}
          <ShowFilters
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
            shows={filteredShows}
            view={view}
            emptyMessage={
              loadError
                ? "The schedule could not be loaded. Please try again."
                : shows.length === 0
                  ? "No screenings have been published for this date."
                  : hasFilters
                    ? "No screenings match the selected filters."
                    : "No screenings are available for this date."
            }
          />
        </>
      )}
    </div>
  );
}
