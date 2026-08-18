import { translations, type Locale } from "../i18n/translations";
import { countLabel } from "../i18n/translations";
import { RiPulseLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  englishFriendly: boolean;
  sort: SortMode;
  view: ViewMode;
  activePreset: QuickPreset | null;
  startingSoonAvailable: boolean;
  resultCount: number;
  hideCinema?: boolean;
  onQueryChange: (value: string) => void;
  onCinemaChange: (value: string) => void;
  onFromTimeChange: (value: string) => void;
  onToTimeChange: (value: string) => void;
  onStartingSoonChange: (value: boolean) => void;
  onEnglishFriendlyChange: (value: boolean) => void;
  onSortChange: (value: SortMode) => void;
  onViewChange: (value: ViewMode) => void;
  onPresetChange: (value: QuickPreset) => void;
  onReset: () => void;
}

export default function ShowFilters({
  locale,
  cinemas,
  query,
  cinema,
  fromTime,
  toTime,
  startingSoon,
  englishFriendly,
  sort,
  view,
  activePreset,
  startingSoonAvailable,
  resultCount,
  hideCinema = false,
  onQueryChange,
  onCinemaChange,
  onFromTimeChange,
  onToTimeChange,
  onStartingSoonChange,
  onEnglishFriendlyChange,
  onSortChange,
  onViewChange,
  onPresetChange,
  onReset,
}: Props) {
  const t = translations[locale].filters;
  const filmForms = translations[locale].hero.films;
  const hasFilters = Boolean(query || cinema || fromTime || toTime || startingSoon || englishFriendly);

  return (
    <section aria-label={t.aria} className="mb-10 overflow-hidden border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <span className="mr-2 text-xs font-medium text-muted-foreground">{t.quickPicks}</span>
        {([
          ["now", t.nextTwoHours],
          ["after-work", t.afterWork],
          ["tonight", t.tonight],
        ] as const).map(([preset, label]) => {
          const disabled = preset === "now" && !startingSoonAvailable;
          return (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={activePreset === preset ? "default" : "outline"}
              disabled={disabled}
              aria-pressed={activePreset === preset}
              onClick={() => onPresetChange(preset)}
              title={disabled ? t.todayOnlyPreset : undefined}
            >
              {label}
            </Button>
          );
        })}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Label htmlFor="show-search" className="text-muted-foreground">{t.search}</Label>
          <Input id="show-search" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t.searchPlaceholder} className="mt-2" />
        </div>

        {!hideCinema && (
          <div>
            <Label htmlFor="show-cinema" className="text-muted-foreground">{t.cinema}</Label>
            <Select value={cinema || null} onValueChange={(value) => onCinemaChange(value ?? "")}>
              <SelectTrigger id="show-cinema" className="mt-2 w-full"><SelectValue placeholder={t.allCinemas} /></SelectTrigger>
              <SelectContent>
                {cinemas.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="show-from" className="text-muted-foreground">{t.from}</Label>
          <Input id="show-from" type="time" value={fromTime} onChange={(event) => onFromTimeChange(event.target.value)} className="mt-2" />
        </div>
        <div>
          <Label htmlFor="show-until" className="text-muted-foreground">{t.until}</Label>
          <Input id="show-until" type="time" value={toTime} onChange={(event) => onToTimeChange(event.target.value)} className="mt-2" />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 border-t border-border bg-muted/30 px-4 py-4 sm:px-5">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{t.viewBy}</legend>
          <div className="flex" role="group">
            {(["cinema", "film"] as const).map((mode) => (
              <Button key={mode} type="button" variant={view === mode ? "default" : "outline"} className="first:border-r-0" aria-pressed={view === mode} onClick={() => onViewChange(mode)}>
                {mode === "cinema" ? t.cinema : t.film}
              </Button>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="show-sort" className="text-muted-foreground">{t.sortBy}</Label>
          <Select value={sort} onValueChange={(value) => onSortChange(value as SortMode)}>
            <SelectTrigger id="show-sort" className="mt-2 min-w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cinema">{t.cinema}</SelectItem>
              <SelectItem value="time">{t.earliest}</SelectItem>
              <SelectItem value="title">{t.title}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground" title={startingSoonAvailable ? t.startingSoonHint : t.todayOnly}>
          <Checkbox checked={startingSoon} disabled={!startingSoonAvailable} onCheckedChange={(value) => onStartingSoonChange(value === true)} />
          {t.startingSoon}
        </Label>
        <Label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground" title={t.englishFriendlyHint}>
          <Checkbox checked={englishFriendly} onCheckedChange={(value) => onEnglishFriendlyChange(value === true)} />
          {t.englishFriendly}
        </Label>

        <Button type="button" variant="ghost" onClick={onReset} disabled={!hasFilters && sort === "cinema"}>{t.reset}</Button>
        <output className="ml-auto flex items-center gap-2 py-2 text-xs text-muted-foreground" aria-live="polite">
          <RiPulseLine className="size-3.5 text-primary" aria-hidden="true" />
          {resultCount} {countLabel(locale, resultCount, filmForms)} {t.inSignal}
        </output>
      </div>
    </section>
  );
}
