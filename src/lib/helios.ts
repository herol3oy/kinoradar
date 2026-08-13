export const HELIOS_ORIGIN = "https://helios.pl";
export const HELIOS_API_ORIGIN = "https://api.helios.pl";
export const HELIOS_TICKETS_ORIGIN = "https://bilety.helios.pl";

export const HELIOS_BLUE_CITY = {
  slug: "helios-blue-city",
  name: "Helios Blue City",
  cinemaId: "26",
  cinemaSourceId: "4ca060df-c4f2-4157-8905-bf46527aae58",
  path: "/warszawa/kino-helios-blue-city",
} as const;

export function heliosScreeningsUrl(): string {
  return `${HELIOS_API_ORIGIN}/api/v1/cinemas/${HELIOS_BLUE_CITY.cinemaId}/screenings`;
}
