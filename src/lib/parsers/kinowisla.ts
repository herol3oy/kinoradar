import * as cheerio from 'cheerio';
import {
  isNovekinoScreeningId,
  novekinoBookingUrl,
  novekinoPosterUrl,
} from '../novekino.ts';
import { fetchWithTimeout } from '../../server/fetch.ts';
import { fetchNovekinoRepertoire, type NovekinoRepertoireEvent } from '../../server/novekino.ts';

const WISLA_BASE_URL = 'https://www.novekino.pl/kina/wisla/';

function dayKey(date?: string | Date): string {
  return typeof date === 'string'
    ? date
    : date
      ? date.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function eventId(value: unknown): string | undefined {
  const id = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  return isNovekinoScreeningId(id) ? id : undefined;
}

function eventTime(value: unknown): string | undefined {
  const match = typeof value === 'string' ? /T([01]\d|2[0-3]):([0-5]\d)/.exec(value) : null;
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function eventLanguage(event: NovekinoRepertoireEvent) {
  const version = [event.details?.dubbing, event.details?.additionalInfo]
    .map(text)
    .filter(Boolean)
    .join(' ')
    .toLocaleUpperCase('pl');
  return {
    ...(/DUB/.test(version) ? { dubbed: true } : {}),
    ...(/NAP/.test(version) ? { subtitled: true } : {}),
  };
}

function eventPresentation(event: NovekinoRepertoireEvent) {
  const printType = event.details?.is_3D === true ? '3D' : event.details?.is_2D === true ? '2D' : undefined;
  return printType ? { presentation: { printType } } : {};
}

function parseTicketingEvents(events: NovekinoRepertoireEvent[], day: string) {
  const groups = new Map<string, {
    title: string;
    poster?: string;
    screenings: Array<Record<string, unknown>>;
  }>();

  for (const event of events) {
    if (typeof event.eventDateTime !== 'string' || !event.eventDateTime.startsWith(`${day}T`)) continue;
    const id = eventId(event.eventId);
    const time = eventTime(event.eventDateTime);
    const title = text(event.eventTitle) ?? text(event.details?.shortName) ?? text(event.details?.name);
    if (!id || !time || !title) continue;
    const imageId = event.imageId ?? event.details?.imageId;
    const poster = typeof imageId === 'number' || (typeof imageId === 'string' && /^\d+$/.test(imageId))
      ? novekinoPosterUrl(imageId)
      : undefined;
    const key = title.toLocaleLowerCase('pl');
    const group = groups.get(key) ?? { title, poster, screenings: [] };
    group.poster ||= poster;
    if (!group.screenings.some((screening) => screening.providerRef
      && (screening.providerRef as { screeningId?: unknown }).screeningId === id)) {
      group.screenings.push({
        time,
        link: novekinoBookingUrl(id),
        providerRef: { provider: 'novekino' as const, screeningId: id },
        ...eventLanguage(event),
        ...eventPresentation(event),
      });
    }
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    screenings: group.screenings.sort((a, b) => String(a.time).localeCompare(String(b.time))),
  }));
}

function absoluteUrl(value: string | undefined, base = WISLA_BASE_URL): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function screeningIdFromLink(value: string | undefined): string | undefined {
  const link = absoluteUrl(value);
  if (!link) return undefined;
  const id = new URL(link).searchParams.get('event_id') ?? '';
  return isNovekinoScreeningId(id) ? id : undefined;
}

async function parseWislaHtml(day: string) {
  const url = `${WISLA_BASE_URL}repertuar.php?data=${day}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Kino Wisła returned ${res.status}`);
  const $ = cheerio.load(await res.text());
  const shows: Array<any> = [];

  $('tr.repertoire-movie-tr').each((_, row) => {
    const title = $(row).find('.repertoire-movie-title a').first().text().trim();
    if (!title) return;

    const link = absoluteUrl($(row).find('.repertoire-movie-title a').first().attr('href'));
    const poster = absoluteUrl($(row).find('.repertoire-movie-poster img').first().attr('src'), 'https://www.novekino.pl/');
    const screenings: Array<Record<string, unknown>> = [];

    $(row).find('.repertoire-movie-time').each((_, el) => {
      const time = String($(el).attr('data-hour') || $(el).text()).trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
      const ticketLink = absoluteUrl($(el).attr('data-buy-link') || $(el).attr('data-reserve-link'));
      const id = screeningIdFromLink(ticketLink);
      screenings.push({
        time,
        ...(ticketLink ? { link: ticketLink } : link ? { link } : {}),
        ...(id ? { providerRef: { provider: 'novekino' as const, screeningId: id } } : {}),
      });
    });

    shows.push({ title, link, poster, screenings });
  });

  return shows;
}

export async function parseKinowisla(date?: string | Date) {
  const day = dayKey(date);
  try {
    return parseTicketingEvents(await fetchNovekinoRepertoire(), day);
  } catch (error) {
    console.error('NoveKino ticketing API failed, using Wisła HTML fallback:', error);
    return parseWislaHtml(day);
  }
}

export const siteName = 'Wisła';
