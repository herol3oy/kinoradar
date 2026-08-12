import {
  MSI_MAX_LIVE_SCREENINGS,
  isMsiScreeningId,
  msiRepertoireUrl,
  type MsiLiveScreening,
} from "../lib/msi.ts";
import { fetchWithTimeout } from "./fetch.ts";

export type MsiFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type MsiRepertoireEvent = {
  eventId?: unknown;
  eventDetailId?: unknown;
  eventTitle?: unknown;
  eventDateTime?: unknown;
  imageId?: unknown;
  linkActive?: unknown;
  linkUrlParam?: {
    event_id?: unknown;
    typetran?: unknown;
    returnlink?: unknown;
  } | null;
  msiFreeSeatsNumber?: unknown;
  msiTotalSeatsNumber?: unknown;
  isClosedSale?: unknown;
  saleEnabled?: unknown;
  saleDisabledTooltip?: unknown;
  details?: {
    id?: unknown;
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

type MsiRepertoireResponse = {
  repertoireEvents?: unknown;
};

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function eventScreeningId(event: MsiRepertoireEvent): string | null {
  const value = typeof event.eventId === "number" || typeof event.eventId === "string"
    ? String(event.eventId)
    : "";
  return isMsiScreeningId(value) ? value : null;
}

export function parseMsiScreeningIds(value: string | null): string[] {
  if (!value) throw new TypeError("Missing screening IDs");
  const ids = [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
  if (!ids.length || ids.length > MSI_MAX_LIVE_SCREENINGS || ids.some((id) => !isMsiScreeningId(id))) {
    throw new TypeError("Invalid screening IDs");
  }
  return ids;
}

export async function fetchMsiRepertoire(
  ticketingBase: string,
  sourceName: string,
  fetcher: MsiFetcher = fetchWithTimeout,
): Promise<MsiRepertoireEvent[]> {
  const response = await fetcher(msiRepertoireUrl(ticketingBase), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${sourceName} ticketing returned ${response.status}`);
  const value = await response.json() as MsiRepertoireResponse;
  if (!value || !Array.isArray(value.repertoireEvents)) {
    throw new Error(`${sourceName} ticketing returned an invalid response`);
  }
  return value.repertoireEvents as MsiRepertoireEvent[];
}

export async function getMsiLiveScreenings(
  ticketingBase: string,
  sourceName: string,
  ids: string[],
  fetcher: MsiFetcher = fetchWithTimeout,
): Promise<MsiLiveScreening[]> {
  const normalizedIds = parseMsiScreeningIds(ids.join(","));
  const requested = new Set(normalizedIds);
  const events = await fetchMsiRepertoire(ticketingBase, sourceName, fetcher);
  const fetchedAt = new Date().toISOString();
  const result: Array<{
    id: string;
    seatsLeft: number | null;
    capacity: number | null;
    saleEnabled: boolean;
    soldOut: boolean;
  }> = [];

  for (const event of events) {
    const id = eventScreeningId(event);
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
