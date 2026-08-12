import { parseNovekinoCinema } from "./novekino.ts";

export async function parseKinowisla(date?: string | Date) {
  return parseNovekinoCinema("wisla", date);
}

export const siteName = "Wisła";
