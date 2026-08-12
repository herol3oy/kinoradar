export const NOVEKINO_REPERTOIRE_URL = "https://wisla.novekino.pl/MSI/mvc/pl/Repertoire/GetShortEventsWithFilters";
export const NOVEKINO_TICKETING_BASE = "https://wisla.novekino.pl/MSI";
export const NOVEKINO_MAX_LIVE_SCREENINGS = 20;

export type NovekinoLiveScreening = {
  screeningId: string;
  seatsLeft: number | null;
  capacity: number | null;
  soldOut: boolean;
  saleEnabled: boolean;
  fetchedAt: string;
};

export function isNovekinoScreeningId(value: string): boolean {
  return /^[1-9]\d{0,9}$/.test(value);
}

export function novekinoBookingUrl(screeningId: string): string {
  const query = new URLSearchParams({
    event_id: screeningId,
    typetran: "0",
    ReturnLink: "https://www.novekino.pl/kina/wisla/repertuar.php",
  });
  return `${NOVEKINO_TICKETING_BASE}/Default.aspx?${query}`;
}

export function novekinoPosterUrl(imageId: string | number): string {
  const query = new URLSearchParams({ id: String(imageId), mode: "thumb" });
  return `${NOVEKINO_TICKETING_BASE}/ImageData.ashx?${query}`;
}
