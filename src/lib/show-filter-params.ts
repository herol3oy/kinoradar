import type { ViewMode } from "./group-shows";

export type SortMode = "cinema" | "title" | "time";

export interface ShowFilterState {
  date: string;
  query: string;
  cinema: string;
  fromTime: string;
  toTime: string;
  startingSoon: boolean;
  englishFriendly: boolean;
  view: ViewMode;
  sort: SortMode;
}

const VIEW_MODES: ViewMode[] = ["cinema", "film"];
const SORT_MODES: SortMode[] = ["cinema", "title", "time"];

export const SHOW_QUERY_MAX_LENGTH = 80;

function parseTime(value: string | null): string {
  if (!value) return "";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "";
}

function parseFlag(value: string | null): boolean {
  return value === "1";
}

export function parseShowFilters(
  params: URLSearchParams,
  today: string,
  validDates: string[],
): ShowFilterState {
  const date = params.get("date");
  const view = params.get("view");
  const sort = params.get("sort");

  return {
    date: date && validDates.includes(date) ? date : today,
    query: (params.get("q") ?? "").trim().slice(0, SHOW_QUERY_MAX_LENGTH),
    cinema: (params.get("cinema") ?? "").trim(),
    fromTime: parseTime(params.get("from")),
    toTime: parseTime(params.get("to")),
    startingSoon: parseFlag(params.get("soon")),
    englishFriendly: parseFlag(params.get("en")),
    view: view && VIEW_MODES.includes(view as ViewMode) ? (view as ViewMode) : "cinema",
    sort: sort && SORT_MODES.includes(sort as SortMode) ? (sort as SortMode) : "cinema",
  };
}

export function serializeShowFilters(state: ShowFilterState, today: string): URLSearchParams {
  const params = new URLSearchParams();
  if (state.date && state.date !== today) params.set("date", state.date);
  if (state.query.trim()) params.set("q", state.query.trim().slice(0, SHOW_QUERY_MAX_LENGTH));
  if (state.cinema) params.set("cinema", state.cinema);
  if (state.fromTime) params.set("from", state.fromTime);
  if (state.toTime) params.set("to", state.toTime);
  if (state.startingSoon) params.set("soon", "1");
  if (state.englishFriendly) params.set("en", "1");
  if (state.view !== "cinema") params.set("view", state.view);
  if (state.sort !== "cinema") params.set("sort", state.sort);
  return params;
}
