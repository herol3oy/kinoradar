export const CINEMA_CITY_ORIGIN = "https://www.cinema-city.pl";
const CINEMA_CITY_TENANT_ID = "10103";

export const CINEMA_CITY_CINEMAS = [
  { key: "arkadia", slug: "cinema-city-arkadia", cinemaId: "1074", name: "Cinema City Arkadia" },
  { key: "bemowo", slug: "cinema-city-bemowo", cinemaId: "1061", name: "Cinema City Bemowo" },
  {
    key: "galeria-polnocna",
    slug: "cinema-city-galeria-polnocna",
    cinemaId: "1096",
    name: "Cinema City Galeria Północna",
  },
  { key: "janki", slug: "cinema-city-janki", cinemaId: "1069", name: "Cinema City Janki" },
  { key: "mokotow", slug: "cinema-city-mokotow", cinemaId: "1070", name: "Cinema City Mokotów" },
  { key: "promenada", slug: "cinema-city-promenada", cinemaId: "1068", name: "Cinema City Promenada" },
  { key: "sadyba", slug: "cinema-city-sadyba", cinemaId: "1060", name: "Cinema City Sadyba" },
] as const;

export type CinemaCityCinema = (typeof CINEMA_CITY_CINEMAS)[number]["key"];
export type CinemaCityCinemaConfig = (typeof CINEMA_CITY_CINEMAS)[number];

export function getCinemaCityCinema(cinema: CinemaCityCinema): CinemaCityCinemaConfig {
  const config = CINEMA_CITY_CINEMAS.find((candidate) => candidate.key === cinema);
  if (!config) throw new Error(`Unknown Cinema City cinema: ${cinema}`);
  return config;
}

export function cinemaCityScheduleUrl(cinemaId: string, day: string): string {
  const url = new URL(
    `/pl/data-api-service/v1/quickbook/${CINEMA_CITY_TENANT_ID}/film-events/in-cinema/${encodeURIComponent(cinemaId)}/at-date/${encodeURIComponent(day)}`,
    CINEMA_CITY_ORIGIN,
  );
  url.searchParams.set("attr", "");
  url.searchParams.set("lang", "pl-PL");
  return url.toString();
}
