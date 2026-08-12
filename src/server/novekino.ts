import {
  NOVEKINO_MAX_LIVE_SCREENINGS,
  isNovekinoScreeningId,
  novekinoRepertoireUrl,
  type NovekinoCinema,
  type NovekinoLiveScreening,
} from "../lib/novekino.ts";
import { fetchWithTimeout } from "./fetch.ts";

export type NovekinoFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type NovekinoRepertoireEvent = {
  eventId?: unknown;
  eventDetailId?: unknown;
  eventTitle?: unknown;
  eventDateTime?: unknown;
  imageId?: unknown;
  msiFreeSeatsNumber?: unknown;
  msiTotalSeatsNumber?: unknown;
  isClosedSale?: unknown;
  saleEnabled?: unknown;
  saleDisabledTooltip?: unknown;
  details?: {
    eventDetailUniqueNumber?: unknown;
    name?: unknown;
    shortName?: unknown;
    dubbing?: unknown;
    additionalInfo?: unknown;
    is_2D?: unknown;
    is_3D?: unknown;
    imageId?: unknown;
  } | null;
};

type NovekinoRepertoireResponse = {
  repertoireEvents?: unknown;
};

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function screeningId(event: NovekinoRepertoireEvent): string | null {
  const value = typeof event.eventId === "number" || typeof event.eventId === "string"
    ? String(event.eventId)
    : "";
  return isNovekinoScreeningId(value) ? value : null;
}

export function parseNovekinoScreeningIds(value: string | null): string[] {
  if (!value) throw new TypeError("Missing screening IDs");
  const ids = [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
  if (!ids.length || ids.length > NOVEKINO_MAX_LIVE_SCREENINGS || ids.some((id) => !isNovekinoScreeningId(id))) {
    throw new TypeError("Invalid screening IDs");
  }
  return ids;
}

export async function fetchNovekinoRepertoire(
  cinema: NovekinoCinema,
  fetcher: NovekinoFetcher = fetchWithTimeout,
): Promise<NovekinoRepertoireEvent[]> {
  const response = await fetcher(novekinoRepertoireUrl(cinema), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`NoveKino ${cinema} ticketing returned ${response.status}`);
  const value = await response.json() as NovekinoRepertoireResponse;
  if (!value || !Array.isArray(value.repertoireEvents)) {
    throw new Error(`NoveKino ${cinema} ticketing returned an invalid response`);
  }
  return value.repertoireEvents as NovekinoRepertoireEvent[];
}

export async function getNovekinoLiveScreenings(
  cinema: NovekinoCinema,
  ids: string[],
  fetcher: NovekinoFetcher = fetchWithTimeout,
): Promise<NovekinoLiveScreening[]> {
  const normalizedIds = parseNovekinoScreeningIds(ids.join(","));
  const requested = new Set(normalizedIds);
  const events = await fetchNovekinoRepertoire(cinema, fetcher);
  const fetchedAt = new Date().toISOString();
  const result: Array<{
    id: string;
    seatsLeft: number | null;
    capacity: number | null;
    saleEnabled: boolean;
    soldOut: boolean;
  }> = [];

  for (const event of events) {
    const id = screeningId(event);
    if (!id || !requested.has(id)) continue;
    const seatsLeft = nonNegativeInteger(event.msiFreeSeatsNumber);
    const capacity = nonNegativeInteger(event.msiTotalSeatsNumber);
    const saleEnabled = event.saleEnabled === true && event.isClosedSale !== true;
    const soldOut = seatsLeft === 0
      || (event.saleEnabled === false
        && typeof event.saleDisabledTooltip === "string"
        && /wyprzedano/iu.test(event.saleDisabledTooltip));
    result.push({ id, seatsLeft, capacity, saleEnabled, soldOut });
  }

  return result
    .sort((a, b) => normalizedIds.indexOf(a.id) - normalizedIds.indexOf(b.id))
    .map(({ id, seatsLeft, capacity, saleEnabled, soldOut }) => ({
      screeningId: id,
      seatsLeft,
      capacity,
      saleEnabled,
      soldOut,
      fetchedAt,
    }));
}
