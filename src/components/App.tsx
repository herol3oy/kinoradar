import { useMemo, useState } from "react";
import type { Show } from "../lib/normalize";
import DateSelector from "./DateSelector";
import ShowFilters, { type SortMode, type ViewMode } from "./ShowFilters";
import TodayShows from "./TodayShows";

interface Props {
  shows: Show[];
}

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

export default function App({ shows: initialShows }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [shows, setShows] = useState<Show[]>(initialShows);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [cinema, setCinema] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [startingSoon, setStartingSoon] = useState(false);
  const [sort, setSort] = useState<SortMode>("cinema");
  const [view, setView] = useState<ViewMode>("cinema");

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
  };

  const handleViewChange = (nextView: ViewMode) => {
    setView(nextView);
    if (nextView === "film" && sort === "cinema") setSort("title");
  };

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setCinema("");
    setStartingSoon(false);
    if (date === today) {
      setShows(initialShows);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/today.json?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setShows(data);
    } catch {
      setShows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-3">
      <DateSelector selected={selectedDate} onChange={handleDateChange} />
      {loading ? (
        <p className="text-retro-cyan text-sm tracking-widest animate-pulse">
          _LOADING...
        </p>
      ) : (
        <>
          <ShowFilters
            cinemas={cinemas}
            query={query}
            cinema={cinema}
            fromTime={fromTime}
            toTime={toTime}
            startingSoon={startingSoon}
            sort={sort}
            view={view}
            startingSoonAvailable={selectedDate === today}
            resultCount={filmCount}
            onQueryChange={setQuery}
            onCinemaChange={setCinema}
            onFromTimeChange={setFromTime}
            onToTimeChange={setToTime}
            onStartingSoonChange={setStartingSoon}
            onSortChange={setSort}
            onViewChange={handleViewChange}
            onReset={resetFilters}
          />
          <TodayShows shows={filteredShows} view={view} />
        </>
      )}
    </div>
  );
}
