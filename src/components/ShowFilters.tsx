export type SortMode = "cinema" | "title" | "time";
export type ViewMode = "cinema" | "film";

interface Props {
  cinemas: string[];
  query: string;
  cinema: string;
  fromTime: string;
  toTime: string;
  startingSoon: boolean;
  sort: SortMode;
  view: ViewMode;
  startingSoonAvailable: boolean;
  resultCount: number;
  onQueryChange: (value: string) => void;
  onCinemaChange: (value: string) => void;
  onFromTimeChange: (value: string) => void;
  onToTimeChange: (value: string) => void;
  onStartingSoonChange: (value: boolean) => void;
  onSortChange: (value: SortMode) => void;
  onViewChange: (value: ViewMode) => void;
  onReset: () => void;
}

const fieldClass =
  "w-full bg-retro-card border border-retro-border text-gray-300 text-sm px-3 py-2 focus:outline-none focus:border-retro-cyan";

export default function ShowFilters({
  cinemas,
  query,
  cinema,
  fromTime,
  toTime,
  startingSoon,
  sort,
  view,
  startingSoonAvailable,
  resultCount,
  onQueryChange,
  onCinemaChange,
  onFromTimeChange,
  onToTimeChange,
  onStartingSoonChange,
  onSortChange,
  onViewChange,
  onReset,
}: Props) {
  const hasFilters = Boolean(query || cinema || fromTime || toTime || startingSoon);

  return (
    <section
      aria-label="Film filters"
      className="mb-6 border border-retro-border bg-retro-surface p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs tracking-widest uppercase text-gray-500 lg:col-span-2">
          [_SEARCH_FILMS]
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="TYPE A TITLE..."
            className={`${fieldClass} mt-1 uppercase placeholder:text-gray-700`}
          />
        </label>

        <label className="text-xs tracking-widest uppercase text-gray-500">
          [_CINEMA]
          <select
            value={cinema}
            onChange={(event) => onCinemaChange(event.target.value)}
            className={`${fieldClass} mt-1 cursor-pointer uppercase`}
          >
            <option value="">ALL CINEMAS</option>
            {cinemas.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs tracking-widest uppercase text-gray-500">
          [_FROM]
          <input
            type="time"
            value={fromTime}
            onChange={(event) => onFromTimeChange(event.target.value)}
            className={`${fieldClass} mt-1 [color-scheme:dark]`}
          />
        </label>

        <label className="text-xs tracking-widest uppercase text-gray-500">
          [_UNTIL]
          <input
            type="time"
            value={toTime}
            onChange={(event) => onToTimeChange(event.target.value)}
            className={`${fieldClass} mt-1 [color-scheme:dark]`}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-retro-border pt-3">
        <fieldset>
          <legend className="text-xs tracking-widest uppercase text-gray-500">[_VIEW]</legend>
          <div className="mt-1 flex" role="group">
            {(["cinema", "film"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewChange(mode)}
                aria-pressed={view === mode}
                className={`border px-3 py-2 text-xs tracking-widest uppercase transition-colors first:border-r-0 ${
                  view === mode
                    ? "border-retro-cyan bg-retro-cyan text-black"
                    : "border-retro-border text-gray-500 hover:border-retro-cyan hover:text-retro-cyan"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-xs tracking-widest uppercase text-gray-500">
          [_SORT]
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortMode)}
            className={`${fieldClass} mt-1 min-w-44 cursor-pointer uppercase`}
          >
            <option value="cinema">CINEMA</option>
            <option value="time">EARLIEST TIME</option>
            <option value="title">TITLE A-Z</option>
          </select>
        </label>

        <label
          className={`flex items-center gap-2 border px-3 py-2 text-xs tracking-widest uppercase ${
            startingSoonAvailable
              ? "cursor-pointer border-retro-border text-retro-yellow"
              : "cursor-not-allowed border-retro-border text-gray-700"
          }`}
          title={startingSoonAvailable ? "Only show screenings starting in the next two hours" : "Available for today only"}
        >
          <input
            type="checkbox"
            checked={startingSoon}
            disabled={!startingSoonAvailable}
            onChange={(event) => onStartingSoonChange(event.target.checked)}
            className="accent-[var(--color-retro-yellow)]"
          />
          STARTING IN 2H
        </label>

        <button
          type="button"
          onClick={onReset}
          disabled={!hasFilters && sort === "cinema"}
          className="border border-retro-border px-3 py-2 text-xs tracking-widest text-retro-green uppercase transition-colors hover:border-retro-green disabled:cursor-not-allowed disabled:opacity-30"
        >
          [ RESET ]
        </button>

        <output className="ml-auto py-2 text-xs tracking-widest text-gray-500 uppercase" aria-live="polite">
          {resultCount} {resultCount === 1 ? "FILM" : "FILMS"} FOUND
        </output>
      </div>
    </section>
  );
}
