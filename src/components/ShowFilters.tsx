export type SortMode = "cinema" | "title" | "time";
export type ViewMode = "cinema" | "film";
export type QuickPreset = "now" | "after-work" | "tonight";

interface Props {
  locale: Locale;
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
  locale,
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
  const t = translations[locale].filters;
  const filmForms = translations[locale].hero.films;
  const hasFilters = Boolean(query || cinema || fromTime || toTime || startingSoon);

  return (
    <section
      aria-label={t.aria}
      className="mb-10 border border-white/8 bg-retro-surface/80 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-4 sm:px-5">
        <span className="mr-2 text-[10px] font-bold tracking-[0.22em] text-gray-500 uppercase">
          {t.quickPicks}
        </span>
        {([
          ["now", t.nextTwoHours],
          ["after-work", t.afterWork],
          ["tonight", t.tonight],
        ] as const).map(([preset, label]) => {
          const disabled = preset === "now" && !startingSoonAvailable;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              aria-pressed={activePreset === preset}
              onClick={() => onPresetChange(preset)}
              title={disabled ? t.todayOnlyPreset : undefined}
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
          {t.search}
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t.searchPlaceholder}
            className={`${fieldClass} mt-2 placeholder:text-gray-700`}
          />
        </label>

        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
          {t.cinema}
          <select
            value={cinema}
            onChange={(event) => onCinemaChange(event.target.value)}
            className={`${fieldClass} mt-2 cursor-pointer uppercase`}
          >
            <option value="">{t.allCinemas}</option>
            {cinemas.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
          {t.from}
          <input
            type="time"
            value={fromTime}
            onChange={(event) => onFromTimeChange(event.target.value)}
            className={`${fieldClass} mt-2 [color-scheme:dark]`}
          />
        </label>

        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
          {t.until}
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
          <legend className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">{t.viewBy}</legend>
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
                {mode === "cinema" ? t.cinema : t.film}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
          {t.sortBy}
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortMode)}
            className={`${fieldClass} mt-2 min-w-44 cursor-pointer uppercase`}
          >
            <option value="cinema">{t.cinema}</option>
            <option value="time">{t.earliest}</option>
            <option value="title">{t.title}</option>
          </select>
        </label>

        <label
          className={`flex items-center gap-2 border px-3 py-2.5 text-[10px] font-bold tracking-widest uppercase ${
            startingSoonAvailable
              ? "cursor-pointer border-white/10 text-retro-yellow hover:border-retro-yellow/50"
              : "cursor-not-allowed border-white/5 text-gray-700"
          }`}
          title={startingSoonAvailable ? t.startingSoonHint : t.todayOnly}
        >
          <input
            type="checkbox"
            checked={startingSoon}
            disabled={!startingSoonAvailable}
            onChange={(event) => onStartingSoonChange(event.target.checked)}
            className="accent-[var(--color-retro-yellow)]"
          />
          {t.startingSoon}
        </label>

        <button
          type="button"
          onClick={onReset}
          disabled={!hasFilters && sort === "cinema"}
          className="border border-white/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-retro-green uppercase transition-colors hover:border-retro-green/60 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {t.reset}
        </button>

        <output className="ml-auto flex items-center gap-2 py-2.5 text-[10px] tracking-[0.16em] text-gray-500 uppercase" aria-live="polite">
          <span className="size-1.5 rounded-full bg-retro-green shadow-[0_0_8px_var(--color-retro-green)]" />
          {resultCount} {countLabel(locale, resultCount, filmForms)} {t.inSignal}
        </output>
      </div>
    </section>
  );
}
import { countLabel, translations, type Locale } from "../i18n/translations";
