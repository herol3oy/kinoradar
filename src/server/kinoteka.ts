import {
  KINOTEKA_CINEMA_ID,
  kinotekaApiUrl,
  type KinotekaLiveScreening,
  type KinotekaTicketOffer,
} from "../lib/kinoteka.ts";
import { fetchWithTimeout } from "./fetch.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ScreeningDetails = {
  audience?: unknown;
  maxOccupancy?: unknown;
  generalAdmission?: unknown;
};

type Seat = {
  id?: unknown;
  kind?: unknown;
  symbol?: unknown;
  wheelchairSeat?: unknown;
};

type Screen = {
  seats?: unknown;
  blockedList?: unknown;
};

type Occupancy = {
  occupiedSeats?: unknown;
  seatsLeft?: unknown;
  lockGroups?: unknown;
};

type RawTicketOffer = {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  priceWithMandatoryExtraFees?: unknown;
};

export function isKinotekaScreeningId(value: string): boolean {
  return UUID.test(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson<T>(fetcher: Fetcher, url: string): Promise<T> {
  const response = await fetcher(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Kinoteka returned ${response.status}`);
  return response.json() as Promise<T>;
}

function normalizeOffers(value: unknown): KinotekaTicketOffer[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const offers: KinotekaTicketOffer[] = [];

  for (const raw of value as RawTicketOffer[]) {
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    const finalPrice = finiteNumber(raw?.priceWithMandatoryExtraFees) ?? finiteNumber(raw?.price);
    if (!name || finalPrice === null || finalPrice < 0) continue;
    const id = typeof raw?.id === "string" && raw.id ? raw.id : `${name}:${finalPrice}`;
    const key = `${id}:${finalPrice}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({ id, name, price: finalPrice });
  }

  return offers;
}

function stringSet(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
}

function unavailableSeatIds(screens: Screen[], occupancy: Occupancy): Set<string> {
  const ids = stringSet(occupancy.occupiedSeats);
  for (const screen of screens) {
    for (const id of stringSet(screen.blockedList)) ids.add(id);
  }
  if (Array.isArray(occupancy.lockGroups)) {
    for (const group of occupancy.lockGroups) {
      if (!group || typeof group !== "object") continue;
      for (const id of stringSet((group as { lockedSeats?: unknown }).lockedSeats)) ids.add(id);
    }
  }
  return ids;
}

function availableStandardSeat(screens: Screen[], occupancy: Occupancy): string | null {
  const unavailable = unavailableSeatIds(screens, occupancy);
  for (const screen of screens) {
    if (!Array.isArray(screen.seats)) continue;
    for (const seat of screen.seats as Seat[]) {
      if (
        typeof seat?.id === "string"
        && seat.kind === "0"
        && typeof seat.symbol === "string"
        && seat.symbol.trim()
        && seat.wheelchairSeat !== true
        && !unavailable.has(seat.id)
      ) return seat.id;
    }
  }
  return null;
}

export async function getKinotekaLiveScreening(
  screeningId: string,
  fetcher: Fetcher = fetchWithTimeout,
): Promise<KinotekaLiveScreening> {
  if (!isKinotekaScreeningId(screeningId)) throw new TypeError("Invalid Kinoteka screening ID");

  const screeningPath = `/cinema/${KINOTEKA_CINEMA_ID}/screening/${screeningId}`;
  const details = await fetchJson<ScreeningDetails>(fetcher, kinotekaApiUrl(screeningPath));
  const booked = finiteNumber(details.audience);
  const capacity = finiteNumber(details.maxOccupancy);
  let seatsLeft: number | null = capacity !== null && booked !== null ? Math.max(0, capacity - booked) : null;
  let offers: KinotekaTicketOffer[] = [];

  try {
    if (details.generalAdmission === true) {
      offers = normalizeOffers(await fetchJson<unknown>(fetcher, kinotekaApiUrl(`${screeningPath}/ga/tickets`)));
    } else {
      const [screenValue, occupancy] = await Promise.all([
        fetchJson<unknown>(fetcher, kinotekaApiUrl(`/cinema/${KINOTEKA_CINEMA_ID}/screen?screeningId=${encodeURIComponent(screeningId)}`)),
        fetchJson<Occupancy>(fetcher, kinotekaApiUrl(`${screeningPath}/occupancy`)),
      ]);
      const screens = Array.isArray(screenValue) ? screenValue as Screen[] : [];
      seatsLeft = finiteNumber(occupancy.seatsLeft) ?? seatsLeft;
      const seatId = availableStandardSeat(screens, occupancy);
      if (seatId) {
        const url = new URL(kinotekaApiUrl(`${screeningPath}/tickets`));
        url.searchParams.set("seatIds", seatId);
        offers = normalizeOffers(await fetchJson<unknown>(fetcher, url.toString()));
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      message: "Kinoteka price lookup failed",
      screeningId,
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  return {
    screeningId,
    booked,
    capacity,
    fromPrice: offers.length ? Math.min(...offers.map((offer) => offer.price)) : null,
    currency: "PLN",
    offers,
    soldOut: seatsLeft !== null ? seatsLeft <= 0 : capacity !== null && booked !== null && booked >= capacity,
    fetchedAt: new Date().toISOString(),
  };
}
