import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { Show } from "../lib/normalize";
import type { ViewMode } from "./ShowFilters";

interface Props {
  shows: Show[];
  view: ViewMode;
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
}: {
  heading: string;
  shows: Show[];
  view: ViewMode;
}) {
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
    <section className="border-b border-retro-border pb-6 mb-6 last:border-b-0">
      <div className="px-4 mb-4">
        <h2 className="text-xl font-bold tracking-widest uppercase text-retro-cyan [text-shadow:0_0_8px_var(--color-retro-cyan)]">
          {heading}
        </h2>
      </div>

      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {shows.map((show, i) => {
              // Use anchor tag if link exists, otherwise fall back to a div
              const CardElement = show.link ? "a" : "div";
              
              return (
                <div
                  key={`${show.cinema}-${show.title}-${i}`}
                  className="flex-[0_0_auto] min-w-0"
                  style={{ flexBasis: "220px" }}
                >
                  <CardElement
                    {...(show.link
                      ? { href: show.link, target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="group bg-retro-card border border-retro-border h-full p-3 flex flex-col transition-all duration-200 hover:border-retro-yellow hover:scale-[1.02] hover:bg-retro-surface cursor-pointer select-none"
                  >
                    {show.poster && (
                      <img
                        src={show.poster}
                        alt={show.title}
                        className="w-full aspect-3/4 object-cover mb-3 opacity-80 transition-opacity duration-200 group-hover:opacity-100"
                      />
                    )}
                    <h3 className="text-sm font-bold text-retro-cyan uppercase tracking-wider mb-2 leading-relaxed">
                      {view === "film" ? show.cinema : show.title}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {show.times.map((time, j) => (
                        <span
                          key={`${time}-${j}`}
                          className="text-xs px-2 py-0.5 border border-retro-border text-retro-yellow"
                        >
                          {time}
                        </span>
                      ))}
                    </div>
                    {show.link && (
                      <span className="inline-block text-xs tracking-widest uppercase text-retro-green group-hover:text-retro-cyan transition-colors mt-auto">
                        [ buy tickets ]
                      </span>
                    )}
                  </CardElement>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={scrollPrev}
          disabled={prevBtnDisabled}
          aria-label="Previous slide"
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-retro-bg/90 border border-retro-border hover:border-retro-cyan text-retro-cyan p-2 transition-colors disabled:opacity-30 disabled:hover:border-retro-border disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={scrollNext}
          disabled={nextBtnDisabled}
          aria-label="Next slide"
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-retro-bg/90 border border-retro-border hover:border-retro-cyan text-retro-cyan p-2 transition-colors disabled:opacity-30 disabled:hover:border-retro-border disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default function TodayShows({ shows, view }: Props) {
  if (!shows.length) {
    return (
      <div className="border border-retro-border bg-retro-surface px-4 py-10 text-center">
        <p className="text-sm tracking-widest text-retro-yellow uppercase">_NO_FILMS_FOUND</p>
        <p className="mt-2 text-xs tracking-wider text-gray-500 uppercase">
          Try changing or resetting the filters.
        </p>
      </div>
    );
  }

  const groups = new Map<string, { heading: string; shows: Show[] }>();

  shows.forEach((show) => {
    const key = view === "film" ? normalizeTitle(show.title) : show.cinema;
    const existing = groups.get(key);
    if (existing) {
      existing.shows.push(show);
    } else {
      groups.set(key, {
        heading: view === "film" ? show.title : show.cinema,
        shows: [show],
      });
    }
  });

  return (
    <div className="w-full">
      {[...groups.entries()].map(([key, group]) => (
        <ShowCarousel key={`${view}-${key}`} heading={group.heading} shows={group.shows} view={view} />
      ))}
    </div>
  );
}
