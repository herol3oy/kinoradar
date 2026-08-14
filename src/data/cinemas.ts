export const cinemas = [
  { slug: "kinoteka", name: "Kinoteka", label: "Kinoteka" },
  { slug: "kinomuranow", name: "Muranów", label: "Kino Muranów" },
  { slug: "u-jazdowski", name: "U-Jazdowski", label: "U-Jazdowski" },
  { slug: "kinowisla", name: "Wisła", label: "Kino Wisła" },
  { slug: "kinoatlantic", name: "Atlantic", label: "Kino Atlantic" },
  { slug: "kinoluna", name: "Kinoluna", label: "Kinoluna" },
  { slug: "kinokultura", name: "Kultura", label: "Kino Kultura" },
  { slug: "kinoamondo", name: "Amondo", label: "Kino Amondo" },
  { slug: "kinoelektronik", name: "Elektronik", label: "Kino Elektronik" },
  { slug: "kinocytadela", name: "Cytadela", label: "Kino Cytadela" },
  { slug: "iluzjon", name: "Iluzjon", label: "Iluzjon" },
  { slug: "kinogram", name: "Kinogram", label: "Kinogram" },
  { slug: "kinomuzeum", name: "KINOMUZEUM", label: "KINOMUZEUM" },
  { slug: "kinopraha", name: "Praha", label: "Kino Praha" },
  { slug: "multikino-reduta", name: "Multikino G City Reduta", label: "Multikino G City Reduta" },
  { slug: "multikino-mlociny", name: "Multikino Młociny", label: "Multikino Młociny" },
  { slug: "multikino-targowek", name: "Multikino G City Targówek", label: "Multikino G City Targówek" },
  { slug: "multikino-wola-park", name: "Multikino Wola Park", label: "Multikino Wola Park" },
  { slug: "multikino-zlote-tarasy", name: "Multikino Złote Tarasy", label: "Multikino Złote Tarasy" },
  { slug: "helios-blue-city", name: "Helios Blue City", label: "Helios Blue City" },
  { slug: "kino-glebocka-66", name: "Kino Głębocka 66", label: "Kino Głębocka 66" },
  { slug: "kino-na-boku", name: "Kino na boku", label: "Kino na boku" },
  { slug: "stacja-falenica", name: "Kinokawiarnia Stacja Falenica", label: "Kinokawiarnia Stacja Falenica" },
] as const;

export type Cinema = (typeof cinemas)[number];
export type CinemaSlug = Cinema["slug"];

export function getCinema(slug: string | undefined): Cinema | undefined {
  return cinemas.find((cinema) => cinema.slug === slug);
}
