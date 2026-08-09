import type { Show } from "./normalize";
import { normalizeFilmTitle } from "./favorites";

export function filmSlug(title: string): string {
  return normalizeFilmTitle(title)
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "film";
}

export function showsForFilm(shows: Show[], slug: string): Show[] {
  return shows.filter((show) => filmSlug(show.title) === slug);
}
