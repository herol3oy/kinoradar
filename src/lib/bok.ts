export const BOK_ORIGIN = "https://bok.waw.pl";

export const BOK_CINEMAS = [
  {
    key: "glebocka-66",
    slug: "kino-glebocka-66",
    name: "Kino Głębocka 66",
    path: "/kino-glebocka-66",
  },
  {
    key: "na-boku",
    slug: "kino-na-boku",
    name: "Kino na boku",
    path: "/kino-na-boku",
  },
] as const;

export type BokCinema = (typeof BOK_CINEMAS)[number]["key"];
export type BokCinemaConfig = (typeof BOK_CINEMAS)[number];

export function getBokCinema(cinema: BokCinema): BokCinemaConfig {
  const config = BOK_CINEMAS.find((candidate) => candidate.key === cinema);
  if (!config) throw new Error(`Unknown BOK cinema: ${cinema}`);
  return config;
}
