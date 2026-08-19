import { useState } from "react";
import { countLabel, translations, type Locale } from "../i18n/translations";
import type { Show } from "../lib/normalize";
import { screeningIdentity, type Screening } from "../lib/screening-language";
import { favoriteKey } from "../lib/favorites";
import { filmSlug } from "../lib/film";
import type { ShowGroup, ViewMode } from "../lib/group-shows";
import Poster from "./Poster";
import ScreeningBadges from "./ScreeningBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { RiArrowRightUpLine, RiStarFill, RiStarLine } from "@remixicon/react";

const COLLAPSED_LIMIT = 10;

interface Props {
  locale: Locale;
  groups: ShowGroup[];
  view: ViewMode;
  emptyMessage?: string;
  selectedDate: string;
  favoriteKeys: Set<string>;
  onToggleFavorite: (show: Show, screening: Screening) => void;
  onResetFilters?: () => void;
}

function ShowGroupSection({
  group,
  view,
  locale,
  selectedDate,
  favoriteKeys,
  onToggleFavorite,
}: {
  group: ShowGroup;
  view: ViewMode;
  locale: Locale;
  selectedDate: string;
  favoriteKeys: Set<string>;
  onToggleFavorite: (show: Show, screening: Screening) => void;
}) {
  const t = translations[locale];
  const [expanded, setExpanded] = useState(false);
  const { heading, shows, source } = group;
  const overflow = shows.length > COLLAPSED_LIMIT;
  const visibleShows = overflow && !expanded ? shows.slice(0, COLLAPSED_LIMIT) : shows;

  return (
    <section id={group.anchorId} className="mb-10 scroll-mt-44 border-b border-border pb-10 last:border-b-0">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {view === "film" ? t.shows.filmSignal : t.shows.cinemaChannel}
          </p>
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">
            {view === "cinema" && source ? (
              <a className="transition-colors hover:text-primary" href={`/${locale}/kino/${source}/`}>
                {heading}
              </a>
            ) : heading}
          </h2>
        </div>
        <Badge variant="outline" className="shrink-0">{shows.length} {countLabel(locale, shows.length, view === "film" ? t.hero.cinemas : t.hero.films)}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleShows.map((show, index) => (
          <article key={`${show.cinema}-${show.title}-${index}`} className="h-full">
            <Card className="h-full">
              <Poster locale={locale} src={show.poster} alt={show.title} />
              <CardHeader className="gap-2">
                <CardTitle className="line-clamp-2 text-base leading-snug">
                  {view === "film" ? show.cinema : show.title}
                </CardTitle>
                {view === "film" && <p className="text-xs text-muted-foreground">{t.shows.warsawVenue}</p>}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-4 flex flex-wrap gap-2">
                  {show.screenings.map((screening, screeningIndex) => {
                    const isFavorite = favoriteKeys.has(favoriteKey(show.canonicalTitle, selectedDate, screening.time, show.cinema, screening, show.source));
                    return (
                      <div key={`${screeningIdentity(screening)}-${screeningIndex}`} className="space-y-1">
                        <div className="flex items-center border border-border bg-muted">
                          <Button
                            type="button"
                            size="sm"
                            variant={isFavorite ? "default" : "secondary"}
                            aria-pressed={isFavorite}
                            aria-label={`${isFavorite ? t.favorites.remove : t.favorites.add}: ${show.canonicalTitle}, ${screening.time}`}
                            title={isFavorite ? t.favorites.remove : t.favorites.add}
                            onClick={() => onToggleFavorite(show, screening)}
                            className="h-8 gap-1.5 rounded-none px-2"
                          >
                            {isFavorite ? <RiStarFill aria-hidden="true" /> : <RiStarLine aria-hidden="true" />}
                            {screening.time}
                          </Button>
                          {screening.link && (
                            <a href={screening.link} target="_blank" rel="noopener noreferrer" aria-label={`${t.shows.buyTickets}: ${show.canonicalTitle}, ${screening.time}`} className="grid size-8 place-items-center border-l border-border text-muted-foreground transition-colors hover:text-primary">
                              <RiArrowRightUpLine size={16} aria-hidden="true" />
                            </a>
                          )}
                        </div>
                        <ScreeningBadges locale={locale} screening={screening} />
                      </div>
                    );
                  })}
                </div>
                <CardFooter className="mt-auto -mx-(--card-spacing) border-t border-border pt-3">
                  <a href={`/${locale}/film/${filmSlug(show.canonicalTitle)}/?date=${selectedDate}`} className="flex w-full items-center justify-between text-xs font-medium text-primary transition-colors hover:text-foreground">
                    {t.filmPage.allScreenings} <span aria-hidden="true">→</span>
                  </a>
                </CardFooter>
              </CardContent>
            </Card>
          </article>
        ))}
      </div>

      {overflow && (
        <div className="mt-4">
          <Button type="button" variant="outline" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? t.shows.showLess : `${t.shows.showAll} (${shows.length})`}
          </Button>
        </div>
      )}
    </section>
  );
}

export default function TodayShows({ locale, groups, view, emptyMessage, selectedDate, favoriteKeys, onToggleFavorite, onResetFilters }: Props) {
  const t = translations[locale].shows;
  if (!groups.length) {
    return (
      <Empty className="min-h-72 border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon"><RiStarLine className="size-4" aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>{t.noFilms}</EmptyTitle>
          <EmptyDescription>{emptyMessage ?? t.tryFilters}</EmptyDescription>
        </EmptyHeader>
        {onResetFilters && (
          <Button type="button" variant="outline" onClick={onResetFilters}>{t.resetFilters}</Button>
        )}
      </Empty>
    );
  }

  return (
    <div className="w-full">
      {groups.map((group) => (
        <ShowGroupSection
          key={`${view}-${group.key}`}
          group={group}
          view={view}
          locale={locale}
          selectedDate={selectedDate}
          favoriteKeys={favoriteKeys}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
