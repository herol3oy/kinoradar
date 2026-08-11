import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { countLabel, translations, type Locale } from "../i18n/translations";
import type { Show } from "../lib/normalize";
import { screeningIdentity, type Screening } from "../lib/screening-language";
import { favoriteKey } from "../lib/favorites";
import { filmSlug } from "../lib/film";
import type { ViewMode } from "./ShowFilters";
import ScreeningBadges from "./ScreeningBadges";

interface Props {
  locale: Locale;
  shows: Show[];
  view: ViewMode;
  emptyMessage?: string;
  selectedDate: string;
  favoriteKeys: Set<string>;
  onToggleFavorite: (show: Show, screening: Screening) => void;
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl")
    .replace(/\s+/g, " ")
    .trim();
}

function ShowCarousel({
  heading,
  shows,
  view,
  locale,
  source,
  selectedDate,
  favoriteKeys,
  onToggleFavorite,
}: {
  heading: string;
  shows: Show[];
  view: ViewMode;
  locale: Locale;
  source?: string;
  selectedDate: string;
  favoriteKeys: Set<string>;
  onToggleFavorite: (show: Show, screening: Screening) => void;
}) {
  const t = translations[locale];
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start" });
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  const onSelect = (api: NonNullable<typeof emblaApi>) => {
    setPrevBtnDisabled(!api.canScrollPrev());
    setNextBtnDisabled(!api.canScrollNext());
  };

  useEffect(() => {
    if (!emblaApi) return;

    onSelect(emblaApi);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("select", onSelect);

    return () => {
      emblaApi.off("reInit", onSelect);
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="mb-12 border-b border-white/8 pb-12 last:border-b-0">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <span className="mb-2 block text-[9px] tracking-[0.24em] text-gray-700 uppercase">
            {view === "film" ? t.shows.filmSignal : t.shows.cinemaChannel}
          </span>
          <h2 className="text-xl font-bold tracking-wide text-white sm:text-2xl">
            {view === "cinema" && source ? (
              <a className="transition-colors hover:text-retro-cyan" href={`/${locale}/kino/${source}/`}>
                {heading}
              </a>
            ) : heading}
          </h2>
        </div>
        <span className="shrink-0 text-[10px] tracking-widest text-gray-600 uppercase">
          {shows.length} {countLabel(locale, shows.length, view === "film" ? t.hero.cinemas : t.hero.films)}
        </span>
      </div>

      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3">
            {shows.map((show, i) => {
              return (
                <div
                  key={`${show.cinema}-${show.title}-${i}`}
                  className="flex-[0_0_auto] min-w-0"
                  style={{ flexBasis: "250px" }}
                >
                  <article
                    className="group relative flex h-full min-h-56 flex-col overflow-hidden border border-white/8 bg-retro-card transition-all duration-300 hover:-translate-y-1 hover:border-retro-yellow/50 hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                  >
                    {show.poster && (
                      <div className="relative aspect-[16/10] overflow-hidden bg-black">
                        <img
                          src={show.poster}
                          alt={show.title}
                          loading="lazy"
                          className="size-full object-cover opacity-65 transition-all duration-500 group-hover:scale-105 group-hover:opacity-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-retro-card via-transparent to-transparent" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="mb-3 text-sm font-bold leading-relaxed tracking-wide text-white">
                        {view === "film" ? show.cinema : show.title}
                      </h3>
                      {view === "film" && (
                        <span className="mb-3 text-[9px] tracking-widest text-gray-600 uppercase">{t.shows.warsawVenue}</span>
                      )}
                      <div className="mb-5 flex flex-wrap gap-1.5">
                        {show.screenings.map((screening, j) => {
                          const isFavorite = favoriteKeys.has(favoriteKey(show.canonicalTitle, selectedDate, screening.time, show.cinema, screening, show.source));
                          return <div key={`${screeningIdentity(screening)}-${j}`} className="space-y-1">
                            <div className={`flex items-center border ${isFavorite ? "border-retro-yellow bg-retro-yellow/10" : "border-retro-yellow/20 bg-retro-yellow/5"}`}>
                              <button
                                type="button"
                                aria-pressed={isFavorite}
                                aria-label={`${isFavorite ? t.favorites.remove : t.favorites.add}: ${show.canonicalTitle}, ${screening.time}`}
                                title={isFavorite ? t.favorites.remove : t.favorites.add}
                                onClick={() => onToggleFavorite(show, screening)}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-retro-yellow transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-retro-cyan"
                              >
                                <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>{screening.time}
                              </button>
                              {screening.link && <a href={screening.link} target="_blank" rel="noopener noreferrer" aria-label={`${t.shows.buyTickets}: ${show.canonicalTitle}, ${screening.time}`} className="border-l border-retro-yellow/20 px-2 py-1 text-xs text-retro-green hover:text-retro-cyan">↗</a>}
                            </div>
                            <ScreeningBadges locale={locale} screening={screening} />
                          </div>;
                        })}
                      </div>
                      <div className="mt-auto space-y-2 border-t border-white/8 pt-3">
                        <a href={`/${locale}/film/${filmSlug(show.canonicalTitle)}/?date=${selectedDate}`} className="flex items-center justify-between text-[10px] font-bold tracking-[0.16em] text-retro-cyan uppercase transition-colors hover:text-white">
                          {t.filmPage.allScreenings} <span aria-hidden="true">→</span>
                        </a>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={scrollPrev}
          disabled={prevBtnDisabled}
          aria-label={t.shows.previous}
          className="absolute -left-2 top-1/2 -translate-y-1/2 border border-white/10 bg-retro-bg/95 p-2.5 text-retro-cyan shadow-xl backdrop-blur transition-colors hover:border-retro-cyan disabled:pointer-events-none disabled:opacity-0 sm:-left-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={scrollNext}
          disabled={nextBtnDisabled}
          aria-label={t.shows.next}
          className="absolute -right-2 top-1/2 -translate-y-1/2 border border-white/10 bg-retro-bg/95 p-2.5 text-retro-cyan shadow-xl backdrop-blur transition-colors hover:border-retro-cyan disabled:pointer-events-none disabled:opacity-0 sm:-right-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default function TodayShows({ locale, shows, view, emptyMessage, selectedDate, favoriteKeys, onToggleFavorite }: Props) {
  const t = translations[locale].shows;
  if (!shows.length) {
    return (
      <div className="border border-dashed border-white/10 bg-white/[0.015] px-4 py-20 text-center">
        <span className="mx-auto mb-5 grid size-12 place-items-center border border-retro-yellow/20 text-xl text-retro-yellow">∅</span>
        <p className="text-xs font-bold tracking-[0.22em] text-retro-yellow uppercase">{t.noFilms}</p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-5 tracking-wider text-gray-600">
          {emptyMessage ?? t.tryFilters}
        </p>
      </div>
    );
  }

  const groups = new Map<string, { heading: string; shows: Show[]; source?: string }>();

  shows.forEach((show) => {
    const key = view === "film" ? normalizeTitle(show.canonicalTitle) : show.cinema;
    const existing = groups.get(key);
    if (existing) {
      existing.shows.push(show);
    } else {
      groups.set(key, {
        heading: view === "film" ? show.canonicalTitle : show.cinema,
        shows: [show],
        source: show.source,
      });
    }
  });

  return (
    <div className="w-full">
      {[...groups.entries()].map(([key, group]) => (
        <ShowCarousel key={`${view}-${key}`} heading={group.heading} shows={group.shows} view={view} locale={locale} source={group.source} selectedDate={selectedDate} favoriteKeys={favoriteKeys} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  );
}
