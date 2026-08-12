import { NOVEKINO_CONFIG, type NovekinoCinema, type NovekinoLiveScreening } from "../lib/novekino.ts";
import {
  fetchMsiRepertoire,
  getMsiLiveScreenings,
  parseMsiScreeningIds,
  type MsiFetcher,
  type MsiRepertoireEvent,
} from "./msi.ts";

export type NovekinoFetcher = MsiFetcher;
export type NovekinoRepertoireEvent = MsiRepertoireEvent;
export const parseNovekinoScreeningIds = parseMsiScreeningIds;

export async function fetchNovekinoRepertoire(
  cinema: NovekinoCinema,
  fetcher?: NovekinoFetcher,
): Promise<NovekinoRepertoireEvent[]> {
  return fetchMsiRepertoire(
    NOVEKINO_CONFIG[cinema].ticketingBase,
    `NoveKino ${cinema}`,
    fetcher,
  );
}

export async function getNovekinoLiveScreenings(
  cinema: NovekinoCinema,
  ids: string[],
  fetcher?: NovekinoFetcher,
): Promise<NovekinoLiveScreening[]> {
  return getMsiLiveScreenings(
    NOVEKINO_CONFIG[cinema].ticketingBase,
    `NoveKino ${cinema}`,
    ids,
    fetcher,
  );
}
