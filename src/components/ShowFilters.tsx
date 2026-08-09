export type SortMode = "cinema" | "title" | "time";
export type ViewMode = "cinema" | "film";
export type QuickPreset = "now" | "after-work" | "tonight";

interface Props {
  cinemas: string[];
  query: string;
  cinema: string;
  fromTime: string;
  toTime: string;
  startingSoon: boolean;
  sort: SortMode;
  view: ViewMode;
  activePreset: QuickPreset | null;
  startingSoonAvailable: boolean;
  resultCount: number;
  onQueryChange: (value: string) => void;
  onCinemaChange: (value: string) => void;
  onFromTimeChange: (value: string) => void;
  onToTimeChange: (value: string) => void;
  onStartingSoonChange: (value: boolean) => void;
  onSortChange: (value: SortMode) => void;
  onViewChange: (value: ViewMode) => void;
  onPresetChange: (value: QuickPreset) => void;
  onReset: () => void;
}

const fieldClass =
  "w-full bg-black/20 border border-white/10 text-gray-200 text-sm px-3 py-2.5 transition-colors focus:outline-none focus:border-retro-cyan/70 hover:border-white/20";

export default function ShowFilters({
  cinemas,
  query,
  cinema,
  fromTime,
  toTime,
  startingSoon,
  sort,
  view,
  activePreset,
  startingSoonAvailable,
  resultCount,
  onQueryChange,
  onCinemaChange,
  onFromTimeChange,
  onToTimeChange,
  onStartingSoonChange,
  onSortChange,
  onViewChange,
  onPresetChange,
  onReset,
}: Props) {
  const hasFilters = Boolean(query || cinema || fromTime || toTime || startingSoon);

  return (
    <section
      aria-label="Film filters"
      className="mb-10 border border-white/8 bg-retro-surface/80 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-4 sm:px-5">
        <span className="mr-2 text-[10px] font-bold tracking-[0.22em] text-gray-500 uppercase">
          Quick picks
        </span>
        {([
          ["now", "NEXT 2 HOURS"],
          ["after-work", "AFTER WORK"],
          ["tonight", "TONIGHT"],
        ] as const).map(([preset, label]) => {
          const disabled = preset === "now" && !startingSoonAvailable;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              aria-pressed={activePreset === preset}
              onClick={() => onPresetChange(preset)}
              title={disabled ? "The next-two-hours preset is available for today only" : undefined}
              className={`border px-3 py-2 text-[10px] font-bold tracking-[0.16em] uppercase transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
                activePreset === preset
                  ? "border-retro-magenta bg-retro-magenta text-black shadow-[0_0_18px_rgba(255,0,255,0.18)]"
                  : "border-white/10 bg-white/[0.02] text-gray-400 hover:border-retro-magenta/60 hover:text-retro-magenta"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500 lg:col-span-2">
          Search films
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Start typing a title..."
            className={`${fieldClass} mt-2 placeholder:text-gray-700`}
          />
        </label>

        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
          Cinema
          <select
            value={cinema}
            onChange={(event) => onCinemaChange(event.target.value)}
            className={`${fieldClass} mt-2 cursor-pointer uppercase`}
          >
            <option value="">ALL CINEMAS</option>
            {cinemas.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
          From
          <input
            type="time"
            value={fromTime}
            onChange={(event) => onFromTimeChange(event.target.value)}
            className={`${fieldClass} mt-2 [color-scheme:dark]`}
          />
        </label>

        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
          Until
          <input
            type="time"
            value={toTime}
            onChange={(event) => onToTimeChange(event.target.value)}
            className={`${fieldClass} mt-2 [color-scheme:dark]`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-white/8 bg-black/10 px-4 py-4 sm:px-5">
        <fieldset>
          <legend className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">View by</legend>
          <div className="mt-2 flex" role="group">
            {(["cinema", "film"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewChange(mode)}
                aria-pressed={view === mode}
                className={`border px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase transition-colors first:border-r-0 ${
                  view === mode
                    ? "border-retro-cyan bg-retro-cyan text-black shadow-[0_0_18px_rgba(0,255,255,0.12)]"
                    : "border-white/10 text-gray-500 hover:border-retro-cyan/50 hover:text-retro-cyan"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
          Sort by
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortMode)}
            className={`${fieldClass} mt-2 min-w-44 cursor-pointer uppercase`}
          >
            <option value="cinema">CINEMA</option>
            <option value="time">EARLIEST TIME</option>
            <option value="title">TITLE A-Z</option>
          </select>
        </label>

        <label
          className={`flex items-center gap-2 border px-3 py-2.5 text-[10px] font-bold tracking-widest uppercase ${
            startingSoonAvailable
              ? "cursor-pointer border-white/10 text-retro-yellow hover:border-retro-yellow/50"
              : "cursor-not-allowed border-white/5 text-gray-700"
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
          className="border border-white/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-retro-green uppercase transition-colors hover:border-retro-green/60 disabled:cursor-not-allowed disabled:opacity-30"
        >
          [ RESET ]
        </button>

        <output className="ml-auto flex items-center gap-2 py-2.5 text-[10px] tracking-[0.16em] text-gray-500 uppercase" aria-live="polite">
          <span className="size-1.5 rounded-full bg-retro-green shadow-[0_0_8px_var(--color-retro-green)]" />
          {resultCount} {resultCount === 1 ? "film" : "films"} in signal
        </output>
      </div>
    </section>
  );
}
