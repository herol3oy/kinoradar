export const MULTIKINO_ORIGIN = "https://www.multikino.pl";

export const MULTIKINO_AUTH_URL = `${MULTIKINO_ORIGIN}/api/microservice/auth/token`;

export const MULTIKINO_CINEMAS = [
  {
    key: "reduta",
    slug: "multikino-reduta",
    cinemaId: "0052",
    name: "Multikino G City Reduta",
  },
  {
    key: "mlociny",
    slug: "multikino-mlociny",
    cinemaId: "0040",
    name: "Multikino Młociny",
  },
  {
    key: "targowek",
    slug: "multikino-targowek",
    cinemaId: "0024",
    name: "Multikino G City Targówek",
  },
  {
    key: "wola-park",
    slug: "multikino-wola-park",
    cinemaId: "0025",
    name: "Multikino Wola Park",
  },
  {
    key: "zlote-tarasy",
    slug: "multikino-zlote-tarasy",
    cinemaId: "0013",
    name: "Multikino Złote Tarasy",
  },
] as const;

export type MultikinoCinema = (typeof MULTIKINO_CINEMAS)[number]["key"];
export type MultikinoCinemaConfig = (typeof MULTIKINO_CINEMAS)[number];

export function getMultikinoCinema(cinema: MultikinoCinema): MultikinoCinemaConfig {
  const config = MULTIKINO_CINEMAS.find((candidate) => candidate.key === cinema);
  if (!config) {
    throw new Error(`Unknown Multikino cinema: ${cinema}`);
  }
  return config;
}

export function multikinoShowingsUrl(cinemaId: string, day: string): string {
  const url = new URL(
    `/api/microservice/showings/cinemas/${encodeURIComponent(cinemaId)}/films`,
    MULTIKINO_ORIGIN,
  );
  url.searchParams.set("showingDate", day);
  url.searchParams.set("minEmbargoLevel", "3");
  url.searchParams.set("includesSession", "true");
  url.searchParams.set("includeSessionAttributes", "true");
  return url.toString();
}
