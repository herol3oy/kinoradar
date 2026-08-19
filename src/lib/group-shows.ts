import type { Locale } from "../i18n/translations";
import type { Show } from "./normalize";

export type ViewMode = "cinema" | "film";

export interface ShowGroup {
  key: string;
  anchorId: string;
  heading: string;
  source?: string;
  shows: Show[];
  filmCount: number;
}

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pl")
    .replace(/\s+/g, " ")
    .trim();
}

function anchorSlug(key: string): string {
  const slug = normalizeTitle(key)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "group";
}

export function groupShows(shows: Show[], view: ViewMode, _locale: Locale): ShowGroup[] {
  const groups = new Map<string, ShowGroup>();
  const used = new Set<string>();

  shows.forEach((show) => {
    const key = view === "film" ? normalizeTitle(show.canonicalTitle) : show.cinema;
    const existing = groups.get(key);
    if (existing) {
      existing.shows.push(show);
      return;
    }

    const base = `group-${anchorSlug(key)}`;
    let anchorId = base;
    let suffix = 2;
    while (used.has(anchorId)) anchorId = `${base}-${suffix++}`;
    used.add(anchorId);

    groups.set(key, {
      key,
      anchorId,
      heading: view === "film" ? show.canonicalTitle : show.cinema,
      source: show.source,
      shows: [show],
      filmCount: 0,
    });
  });

  return [...groups.values()].map((group) => ({ ...group, filmCount: group.shows.length }));
}
