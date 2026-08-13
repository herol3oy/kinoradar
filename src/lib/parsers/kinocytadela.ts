import * as cheerio from "cheerio";
import { normalizeWarsawDate, warsawDate } from "../warsaw-date.ts";
import { fetchWithTimeout } from "../../server/fetch.ts";

const CYTADELA_ORIGIN = "https://muzhp.pl";
const CYTADELA_TICKETS_ORIGIN = "https://sklep.muzhp.pl";

type CytadelaScreening = {
  time: string;
  link?: string;
  language?: { subtitled: true };
  providerRef?: { provider: "muzhp"; screeningId: string };
};

export type CytadelaShow = {
  title: string;
  link?: string;
  poster?: string;
  screenings: CytadelaScreening[];
  screeningLinksAreExplicit: true;
};

type ParseOptions = { fetcher?: typeof fetch };

function normalizedDay(value?: string | Date): string {
  if (typeof value === "string") return normalizeWarsawDate(value);
  return warsawDate(value instanceof Date ? value : undefined);
}

function validUrl(value: unknown, hostname: string, origin: string): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value, origin);
    return url.protocol === "https:" && url.hostname === hostname ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function ticketDetails(value: unknown): { link?: string; screeningId?: string } {
  const link = validUrl(value, "sklep.muzhp.pl", CYTADELA_TICKETS_ORIGIN);
  if (!link) return {};
  const url = new URL(link);
  const screeningId = url.searchParams.get("id") ?? undefined;
  const token = url.searchParams.get("idt");
  if (url.pathname !== "/rezerwacja/rezerwacja/numerowane.html"
    || !screeningId || !/^\d+$/.test(screeningId) || !token
    || [...url.searchParams.keys()].some((key) => key !== "id" && key !== "idt")) return {};
  return { link, screeningId };
}

export async function parseKinocytadela(
  date?: string | Date,
  options: ParseOptions = {},
): Promise<CytadelaShow[]> {
  const day = normalizedDay(date);
  const fetcher = options.fetcher ?? fetchWithTimeout;
  const response = await fetcher(`${CYTADELA_ORIGIN}/repertuar`, {
    headers: { Accept: "text/html" },
  });
  if (!response.ok) throw new Error(`Kino Cytadela returned ${response.status}`);
  const $ = cheerio.load(await response.text());
  const groups = new Map<string, CytadelaShow>();
  let itemDay: string | undefined;

  $(".repertoire-list__title, div.repertoire-item").each((_, element) => {
    const current = $(element);
    if (current.hasClass("repertoire-list__title")) {
      const candidate = current.attr("datetime") || current.attr("data-time");
      itemDay = typeof candidate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate)
        ? candidate
        : undefined;
      return;
    }
    if (itemDay !== day) return;

    const titleAnchor = current.find(".repertoire-item__content__title a").first();
    const title = titleAnchor.text().replace(/\s+/g, " ").trim();
    const time = current.find("time.repertoire-item__time").first().attr("datetime")
      || current.find("time.repertoire-item__time").first().text().trim();
    if (!title || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return;

    const detailLink = validUrl(titleAnchor.attr("href"), "muzhp.pl", CYTADELA_ORIGIN);
    const poster = validUrl(
      current.find("img.repertoire-item__image").first().attr("src"),
      "muzhp.pl",
      CYTADELA_ORIGIN,
    );
    const ticket = ticketDetails(
      current.find("a.repertoire-item__container__button--dark").first().attr("href"),
    );
    const info = current.find(".repertoire-item__info").text().toLocaleLowerCase("pl-PL");
    const key = `${title}|${detailLink ?? ""}`;
    let show = groups.get(key);
    if (!show) {
      show = {
        title,
        link: detailLink,
        poster,
        screenings: [],
        screeningLinksAreExplicit: true,
      };
      groups.set(key, show);
    }
    show.screenings.push({
      time,
      link: ticket.link,
      language: /\bnapisy\b/u.test(info) ? { subtitled: true } : undefined,
      providerRef: ticket.screeningId
        ? { provider: "muzhp", screeningId: ticket.screeningId }
        : undefined,
    });
  });

  return [...groups.values()].map((show) => ({
    ...show,
    screenings: show.screenings.sort((a, b) => a.time.localeCompare(b.time)),
  }));
}

export const siteName = "Cytadela";
