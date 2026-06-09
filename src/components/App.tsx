import { useState } from "react";
import type { Show } from "../lib/normalize";
import DateSelector from "./DateSelector";
import TodayShows from "./TodayShows";

interface Props {
  shows: Show[];
}

export default function App({ shows: initialShows }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [shows, setShows] = useState<Show[]>(initialShows);
  const [loading, setLoading] = useState(false);

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
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
        <TodayShows shows={shows} />
      )}
    </div>
  );
}
