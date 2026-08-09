import { translations, type Locale } from "../i18n/translations";
import { useFavorites } from "../lib/useFavorites";

export default function FavoritesNavLink({ locale }: { locale: Locale }) {
  const { favorites } = useFavorites();
  const t = translations[locale].favorites;

  return (
    <a
      href={`/${locale}/favorites/`}
      className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-gray-400 uppercase transition-colors hover:text-retro-yellow"
      aria-label={`${t.nav}: ${favorites.length}`}
    >
      <span className="text-base text-retro-yellow" aria-hidden="true">★</span>
      <span className="hidden sm:inline">{t.nav}</span>
      <span className="grid min-w-5 place-items-center border border-retro-yellow/30 px-1 py-0.5 text-retro-yellow">{favorites.length}</span>
    </a>
  );
}
