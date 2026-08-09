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
] as const;

export type Cinema = (typeof cinemas)[number];
export type CinemaSlug = Cinema["slug"];

export function getCinema(slug: string | undefined): Cinema | undefined {
  return cinemas.find((cinema) => cinema.slug === slug);
}
