import { useEffect, useState } from "react";
import type { Show } from "./normalize";
import {
  FAVORITES_CHANGED_EVENT,
  FAVORITES_STORAGE_KEY,
  MAX_FAVORITES,
  favoriteFromShow,
  favoriteKey,
  sanitizeFavorites,
  type FavoriteFilm,
} from "./favorites";

function loadFavorites(): FavoriteFilm[] {
  if (typeof window === "undefined") return [];
  try {
    return sanitizeFavorites(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteFilm[]>([]);

  useEffect(() => {
    const sync = () => setFavorites(loadFavorites());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
    };
  }, []);

  const save = (next: FavoriteFilm[]) => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    setFavorites(next);
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  };

  const toggle = (show: Show, date: string, time: string): "added" | "removed" | "full" => {
    const key = favoriteKey(show.title, date, time, show.cinema);
    const current = loadFavorites();
    if (current.some((film) => favoriteKey(film.title, film.date, film.time, film.cinema) === key)) {
      save(current.filter((film) => favoriteKey(film.title, film.date, film.time, film.cinema) !== key));
      return "removed";
    }
    if (current.length >= MAX_FAVORITES) return "full";
    save([...current, favoriteFromShow(show, date, time)]);
    return "added";
  };

  const remove = (film: FavoriteFilm) => {
    const key = favoriteKey(film.title, film.date, film.time, film.cinema);
    save(loadFavorites().filter((item) => favoriteKey(item.title, item.date, item.time, item.cinema) !== key));
  };

  const clear = () => save([]);

  return { favorites, toggle, remove, clear };
}
