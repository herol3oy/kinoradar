import {
  MSI_MAX_LIVE_SCREENINGS,
  isMsiScreeningId,
  msiPosterUrl,
  msiRepertoireUrl,
  type MsiLiveScreening,
} from "./msi.ts";

export const NOVEKINO_CINEMAS = ["wisla", "atlantic"] as const;
export type NovekinoCinema = (typeof NOVEKINO_CINEMAS)[number];

export const NOVEKINO_CONFIG: Record<NovekinoCinema, {
  publicBase: string;
  ticketingBase: string;
  returnUrl: string;
}> = {
  wisla: {
    publicBase: "https://www.novekino.pl/kina/wisla/",
    ticketingBase: "https://wisla.novekino.pl/MSI",
    returnUrl: "https://www.novekino.pl/kina/wisla/repertuar.php",
  },
  atlantic: {
    publicBase: "https://www.novekino.pl/kina/atlantic/",
    ticketingBase: "https://atlantic.novekino.pl/MSI",
    returnUrl: "https://www.novekino.pl/kina/atlantic/dziekujemy.php",
  },
};

export const NOVEKINO_MAX_LIVE_SCREENINGS = MSI_MAX_LIVE_SCREENINGS;
export type NovekinoLiveScreening = MsiLiveScreening;

export function isNovekinoCinema(value: unknown): value is NovekinoCinema {
  return typeof value === "string" && NOVEKINO_CINEMAS.includes(value as NovekinoCinema);
}

export function isNovekinoScreeningId(value: string): boolean {
  return isMsiScreeningId(value);
}

export function novekinoRepertoireUrl(cinema: NovekinoCinema): string {
  return msiRepertoireUrl(NOVEKINO_CONFIG[cinema].ticketingBase);
}

export function novekinoBookingUrl(cinema: NovekinoCinema, screeningId: string): string {
  const config = NOVEKINO_CONFIG[cinema];
  const query = new URLSearchParams({
    event_id: screeningId,
    typetran: "0",
    ReturnLink: config.returnUrl,
  });
  return `${config.ticketingBase}/Default.aspx?${query}`;
}

export function novekinoPosterUrl(cinema: NovekinoCinema, imageId: string | number): string {
  return msiPosterUrl(NOVEKINO_CONFIG[cinema].ticketingBase, imageId);
}
