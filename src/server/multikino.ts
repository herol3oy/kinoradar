import {
  MULTIKINO_AUTH_URL,
  multikinoShowingsUrl,
} from "../lib/multikino.ts";
import { fetchWithTimeout } from "./fetch.ts";

const AUTH_COOKIE_NAMES = [
  "microservicesToken",
  "microservicesRefreshToken",
  "accessTokenExpirationTime",
  "refreshTokenExpirationTime",
] as const;

type Fetcher = typeof fetch;

export interface MultikinoClient {
  getShowings(cinemaId: string, day: string): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readAuthCookies(headers: Headers): string {
  const allowed = new Set<string>(AUTH_COOKIE_NAMES);
  const cookies = new Map<string, string>();

  for (const setCookie of headers.getSetCookie()) {
    const pair = setCookie.split(";", 1)[0]?.trim();
    const separator = pair?.indexOf("=") ?? -1;
    if (!pair || separator <= 0) continue;

    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (allowed.has(name) && value) cookies.set(name, value);
  }

  const missing = AUTH_COOKIE_NAMES.filter((name) => !cookies.has(name));
  if (missing.length > 0) {
    throw new Error(`Multikino authentication did not set ${missing.join(", ")}`);
  }

  return AUTH_COOKIE_NAMES.map((name) => `${name}=${cookies.get(name)}`).join("; ");
}

async function authenticate(fetcher: Fetcher): Promise<string> {
  const response = await fetcher(MULTIKINO_AUTH_URL, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Multikino authentication failed with HTTP ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!isRecord(body) || body.responseCode !== 0 || !isRecord(body.result)) {
    throw new Error("Multikino authentication returned an invalid response");
  }

  return readAuthCookies(response.headers);
}

export function createMultikinoClient(fetcher: Fetcher = fetchWithTimeout): MultikinoClient {
  let sessionPromise: Promise<string> | undefined;

  function getSession(): Promise<string> {
    sessionPromise ??= authenticate(fetcher);
    return sessionPromise;
  }

  function refreshSession(failedCookie: string): Promise<string> {
    const failedSession = sessionPromise;
    if (!failedSession) {
      sessionPromise = authenticate(fetcher);
      return sessionPromise;
    }

    return failedSession.then((currentCookie) => {
      if (currentCookie === failedCookie && sessionPromise === failedSession) {
        sessionPromise = authenticate(fetcher);
      }
      return sessionPromise as Promise<string>;
    });
  }

  async function requestShowings(cinemaId: string, day: string, cookie: string): Promise<Response> {
    return fetcher(multikinoShowingsUrl(cinemaId, day), {
      headers: {
        Accept: "application/json",
        Cookie: cookie,
      },
    });
  }

  return {
    async getShowings(cinemaId, day) {
      let cookie = await getSession();
      let response = await requestShowings(cinemaId, day, cookie);

      if (response.status === 401) {
        cookie = await refreshSession(cookie);
        response = await requestShowings(cinemaId, day, cookie);
      }

      if (!response.ok) {
        throw new Error(`Multikino schedule failed with HTTP ${response.status}`);
      }
      return response.json();
    },
  };
}
