import { translations, type Locale } from "../i18n/translations";
import { useFavorites } from "../lib/useFavorites";
import { RiStarFill } from "@remixicon/react";

export default function FavoritesNavLink({ locale }: { locale: Locale }) {
  const { favorites } = useFavorites();
  const t = translations[locale].favorites;

  return (
    <a
      href={`/${locale}/favorites/`}
      className="inline-flex h-8 items-center gap-2 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={`${t.nav}: ${favorites.length}`}
    >
      <RiStarFill className="size-4 text-primary" aria-hidden="true" />
      <span className="hidden sm:inline">{t.nav}</span>
      <span className="grid min-w-5 place-items-center border border-primary/30 px-1 text-xs text-primary">{favorites.length}</span>
    </a>
  );
}
