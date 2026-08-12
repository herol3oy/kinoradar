import { MSI_MAX_LIVE_SCREENINGS, isMsiScreeningId, msiPosterUrl, type MsiLiveScreening } from "./msi.ts";

export const KINO_KULTURA_TICKETING_BASE = "https://rezerwacja.kinokultura.pl/MSI";
export const KINO_KULTURA_MAX_LIVE_SCREENINGS = MSI_MAX_LIVE_SCREENINGS;
export type KinokulturaLiveScreening = MsiLiveScreening;

export function isKinokulturaScreeningId(value: string): boolean {
  return isMsiScreeningId(value);
}

export function kinokulturaRepertoireUrl(day: string): string {
  const query = new URLSearchParams({ sort: "Name", date: day, datestart: "0" });
  return `${KINO_KULTURA_TICKETING_BASE}/mvc/pl?${query}`;
}

export function kinokulturaBookingUrl(
  screeningId: string,
  transactionMode: 0 | 1,
  day: string,
): string {
  const query = new URLSearchParams({
    event_id: screeningId,
    typetran: String(transactionMode),
    returnlink: `~/mvc/pl?sort=Name&date=${day}`,
  });
  return `${KINO_KULTURA_TICKETING_BASE}/Default.aspx?${query}`;
}

export function kinokulturaPosterUrl(imageId: string | number): string {
  return msiPosterUrl(KINO_KULTURA_TICKETING_BASE, imageId);
}
