import { KINO_KULTURA_TICKETING_BASE, type KinokulturaLiveScreening } from "../lib/kinokultura.ts";
import {
  fetchMsiRepertoire,
  getMsiLiveScreenings,
  parseMsiScreeningIds,
  type MsiFetcher,
  type MsiRepertoireEvent,
} from "./msi.ts";

export type KinokulturaFetcher = MsiFetcher;
export type KinokulturaRepertoireEvent = MsiRepertoireEvent;
export const parseKinokulturaScreeningIds = parseMsiScreeningIds;

export async function fetchKinokulturaRepertoire(
  fetcher?: KinokulturaFetcher,
): Promise<KinokulturaRepertoireEvent[]> {
  return fetchMsiRepertoire(KINO_KULTURA_TICKETING_BASE, "Kino Kultura", fetcher);
}

export async function getKinokulturaLiveScreenings(
  ids: string[],
  fetcher?: KinokulturaFetcher,
): Promise<KinokulturaLiveScreening[]> {
  return getMsiLiveScreenings(KINO_KULTURA_TICKETING_BASE, "Kino Kultura", ids, fetcher);
}
