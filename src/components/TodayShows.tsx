import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { countLabel, translations, type Locale } from "../i18n/translations";
import type { Show } from "../lib/normalize";
import type { ViewMode } from "./ShowFilters";

interface Props {
  locale: Locale;
  shows: Show[];
  view: ViewMode;
  emptyMessage?: string;
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
}: {
  heading: string;
  shows: Show[];
  view: ViewMode;
  locale: Locale;
  source?: string;
}) {
  const t = translations[locale];
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start" });
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback((api: NonNullable<typeof emblaApi>) => {
    setPrevBtnDisabled(!api.canScrollPrev());
    setNextBtnDisabled(!api.canScrollNext());
  }, []);

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
              // Use anchor tag if link exists, otherwise fall back to a div
              const CardElement = show.link ? "a" : "div";
              
              return (
                <div
                  key={`${show.cinema}-${show.title}-${i}`}
                  className="flex-[0_0_auto] min-w-0"
                  style={{ flexBasis: "250px" }}
                >
                  <CardElement
                    {...(show.link
                      ? { href: show.link, target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="group relative flex h-full min-h-56 flex-col overflow-hidden border border-white/8 bg-retro-card transition-all duration-300 hover:-translate-y-1 hover:border-retro-yellow/50 hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)] cursor-pointer select-none"
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
                        {show.times.map((time, j) => (
                          <span
                            key={`${time}-${j}`}
                            className="border border-retro-yellow/20 bg-retro-yellow/5 px-2 py-1 text-xs font-bold text-retro-yellow"
                          >
                            {time}
                          </span>
                        ))}
                      </div>
                      {show.link && (
                        <span className="mt-auto flex items-center justify-between border-t border-white/8 pt-3 text-[10px] font-bold tracking-[0.16em] text-retro-green uppercase transition-colors group-hover:text-retro-cyan">
                          {t.shows.buyTickets} <span aria-hidden="true">↗</span>
                        </span>
                      )}
                    </div>
                  </CardElement>
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

export default function TodayShows({ locale, shows, view, emptyMessage }: Props) {
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
    const key = view === "film" ? normalizeTitle(show.title) : show.cinema;
    const existing = groups.get(key);
    if (existing) {
      existing.shows.push(show);
    } else {
      groups.set(key, {
        heading: view === "film" ? show.title : show.cinema,
        shows: [show],
        source: show.source,
      });
    }
  });

  return (
    <div className="w-full">
      {[...groups.entries()].map(([key, group]) => (
        <ShowCarousel key={`${view}-${key}`} heading={group.heading} shows={group.shows} view={view} locale={locale} source={group.source} />
      ))}
    </div>
  );
}
