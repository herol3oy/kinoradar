import { translations, type Locale } from "../i18n/translations";
import { filmSlug } from "../lib/film";
import type { PopularScreeningItem } from "../lib/popular-screenings";
import Poster from "./Poster";
import ScreeningBadges from "./ScreeningBadges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RiArrowRightUpLine } from "@remixicon/react";

interface Props {
  locale: Locale;
  items: PopularScreeningItem[];
  selectedDate: string;
}

export default function PopularScreenings({ locale, items, selectedDate }: Props) {
  const t = translations[locale];
  if (!items.length) return null;

  return (
    <section className="mb-10 border-b border-border pb-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t.popular.eyebrow}</p>
          <h2 className="font-heading text-xl font-semibold sm:text-2xl">
            {t.popular.title} <span className="text-primary">{t.popular.accent}</span>
          </h2>
        </div>
        <Badge variant="outline" className="shrink-0">{items.length}</Badge>
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto py-1">
        {items.map((item) => (
          <div key={item.filmwebId} className="w-56 shrink-0 snap-start sm:w-64">
            <article className="h-full">
              <Card className="h-full">
                <Poster locale={locale} src={item.posterUrl} alt={item.displayTitle} />
                <CardHeader className="gap-2">
                  <CardTitle className="line-clamp-2 text-base leading-snug">
                    {item.displayTitle}{item.year ? ` (${item.year})` : ""}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{item.cinema}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {item.upcoming ? t.popular.nextScreening : t.popular.laterToday}
                  </p>
                  <div className="mb-4 space-y-1">
                    <div className="flex items-center border border-border bg-muted">
                      <span className="px-2 py-1.5 text-sm font-medium">{item.screening.time}</span>
                      {item.screening.link && (
                        <a
                          href={item.screening.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${t.shows.buyTickets}: ${item.title}, ${item.screening.time}`}
                          className="ml-auto grid size-8 place-items-center border-l border-border text-muted-foreground transition-colors hover:text-primary"
                        >
                          <RiArrowRightUpLine size={16} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                    <ScreeningBadges locale={locale} screening={item.screening} />
                  </div>
                  <CardFooter className="mt-auto -mx-(--card-spacing) border-t border-border pt-3">
                    <a href={`/${locale}/film/${filmSlug(item.title)}/?date=${selectedDate}`} className="flex w-full items-center justify-between text-xs font-medium text-primary transition-colors hover:text-foreground">
                      {t.filmPage.allScreenings} <span aria-hidden="true">→</span>
                    </a>
                  </CardFooter>
                </CardContent>
              </Card>
            </article>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t.popular.attribution}</p>
    </section>
  );
}
