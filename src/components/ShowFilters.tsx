import { useState, type ReactNode } from "react";
import { translations, type Locale } from "../i18n/translations";
import { countLabel } from "../i18n/translations";
import type { ViewMode } from "../lib/group-shows";
import type { SortMode } from "../lib/show-filter-params";
import { RiCloseLine, RiEqualizerLine, RiPulseLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
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

export type QuickPreset = "now" | "after-work" | "tonight";
export type { SortMode, ViewMode };

export interface FilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

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
  chips?: FilterChip[];
  jumpNav?: ReactNode;
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

function ActiveFilterChips({ locale, chips }: { locale: Locale; chips: FilterChip[] }) {
  const t = translations[locale].filters;

  return (
    <div className="flex flex-wrap items-center gap-2 pb-3" aria-label={t.activeFilters}>
      <span className="text-xs font-medium text-muted-foreground">{t.activeFilters}</span>
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
          {chip.label}
          <button
            type="button"
            aria-label={`${t.clearFilter}: ${chip.label}`}
            onClick={chip.onClear}
            className="grid size-4 place-items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <RiCloseLine size={12} aria-hidden="true" />
          </button>
        </Badge>
      ))}
    </div>
  );
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
  chips = [],
  jumpNav,
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
  const [expanded, setExpanded] = useState(
    () => Boolean(fromTime || toTime || startingSoon || englishFriendly),
  );

  return (
    <section
      aria-label={t.aria}
      className="sticky top-16 z-40 -mx-4 mb-8 border-b border-border bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex flex-wrap items-end gap-3 py-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="show-search" className="sr-only">{t.search}</Label>
          <Input id="show-search" type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t.searchPlaceholder} />
        </div>

        {!hideCinema && (
          <div className="min-w-40">
            <Label htmlFor="show-cinema" className="sr-only">{t.cinema}</Label>
            <Select value={cinema || null} onValueChange={(value) => onCinemaChange(value ?? "")}>
              <SelectTrigger id="show-cinema" className="w-full"><SelectValue placeholder={t.allCinemas} /></SelectTrigger>
              <SelectContent>
                {cinemas.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex" role="group" aria-label={t.viewBy}>
          {(["cinema", "film"] as const).map((mode) => (
            <Button key={mode} type="button" size="sm" variant={view === mode ? "default" : "outline"} className="first:border-r-0" aria-pressed={view === mode} onClick={() => onViewChange(mode)}>
              {mode === "cinema" ? t.cinema : t.film}
            </Button>
          ))}
        </div>

        <div className="min-w-40">
          <Label htmlFor="show-sort" className="sr-only">{t.sortBy}</Label>
          <Select value={sort} onValueChange={(value) => onSortChange(value as SortMode)}>
            <SelectTrigger id="show-sort" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cinema">{t.cinema}</SelectItem>
              <SelectItem value="time">{t.earliest}</SelectItem>
              <SelectItem value="title">{t.title}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="button" size="sm" variant="outline" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          <RiEqualizerLine size={16} aria-hidden="true" />
          {expanded ? t.fewerFilters : t.moreFilters}
        </Button>

        <Button type="button" size="sm" variant="ghost" onClick={onReset} disabled={!hasFilters && sort === "cinema"}>{t.reset}</Button>

        <output className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <RiPulseLine className="size-3.5 text-primary" aria-hidden="true" />
          {resultCount} {countLabel(locale, resultCount, filmForms)} {t.inSignal}
        </output>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-end gap-4 border-t border-border py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-muted-foreground">{t.quickPicks}</span>
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

          <div>
            <Label htmlFor="show-from" className="text-muted-foreground">{t.from}</Label>
            <Input id="show-from" type="time" value={fromTime} onChange={(event) => onFromTimeChange(event.target.value)} className="mt-2" />
          </div>
          <div>
            <Label htmlFor="show-until" className="text-muted-foreground">{t.until}</Label>
            <Input id="show-until" type="time" value={toTime} onChange={(event) => onToTimeChange(event.target.value)} className="mt-2" />
          </div>

          <Label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground" title={startingSoonAvailable ? t.startingSoonHint : t.todayOnly}>
            <Checkbox checked={startingSoon} disabled={!startingSoonAvailable} onCheckedChange={(value) => onStartingSoonChange(value === true)} />
            {t.startingSoon}
          </Label>
          <Label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground" title={t.englishFriendlyHint}>
            <Checkbox checked={englishFriendly} onCheckedChange={(value) => onEnglishFriendlyChange(value === true)} />
            {t.englishFriendly}
          </Label>
        </div>
      )}

      {chips.length > 0 && <ActiveFilterChips locale={locale} chips={chips} />}
      {jumpNav}
    </section>
  );
}
