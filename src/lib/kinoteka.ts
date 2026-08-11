export const KINOTEKA_API_BASE = "https://restapi.kinoteka.pl/api";
export const KINOTEKA_CINEMA_ID = "9ef78349-db9c-4dfc-85aa-96d030082c0d";

export type KinotekaTicketOffer = {
  id: string;
  name: string;
  price: number;
};

export type KinotekaLiveScreening = {
  screeningId: string;
  booked: number | null;
  capacity: number | null;
  fromPrice: number | null;
  currency: "PLN";
  offers: KinotekaTicketOffer[];
  soldOut: boolean;
  fetchedAt: string;
};

export function kinotekaApiUrl(path: string): string {
  return `${KINOTEKA_API_BASE}${path}`;
}

export function kinotekaBookingUrl(screeningId: string): string {
  const query = new URLSearchParams({
    screeningId,
    cinemaId: KINOTEKA_CINEMA_ID,
  });
  return `https://bilety.kinoteka.pl/#/screen?${query}`;
}
