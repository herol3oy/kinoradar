export const MSI_MAX_LIVE_SCREENINGS = 20;

export type MsiLiveScreening = {
  screeningId: string;
  seatsLeft: number | null;
  capacity: number | null;
  soldOut: boolean;
  saleEnabled: boolean;
  fetchedAt: string;
};

export function isMsiScreeningId(value: string): boolean {
  return /^[1-9]\d{0,9}$/.test(value);
}

export function msiRepertoireUrl(ticketingBase: string): string {
  return `${ticketingBase}/mvc/pl/Repertoire/GetShortEventsWithFilters`;
}

export function msiPosterUrl(ticketingBase: string, imageId: string | number): string {
  const query = new URLSearchParams({ id: String(imageId), mode: "thumb" });
  return `${ticketingBase}/ImageData.ashx?${query}`;
}
