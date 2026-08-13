import { cinemaCityScheduleUrl } from "../lib/cinema-city.ts";
import { fetchWithTimeout } from "./fetch.ts";

type Fetcher = typeof fetch;

export interface CinemaCityClient {
  getShowings(cinemaId: string, day: string): Promise<unknown>;
}

export function createCinemaCityClient(fetcher: Fetcher = fetchWithTimeout): CinemaCityClient {
  return {
    async getShowings(cinemaId, day) {
      const response = await fetcher(cinemaCityScheduleUrl(cinemaId, day), {
        headers: { Accept: "application/json;charset=utf-8" },
      });
      if (!response.ok) {
        throw new Error(`Cinema City schedule failed with HTTP ${response.status}`);
      }
      return response.json();
    },
  };
}
