import { parseNovekinoCinema } from "./novekino.ts";

export async function parseKinoatlantic(date?: string | Date) {
  return parseNovekinoCinema("atlantic", date);
}

export const siteName = "Atlantic";
