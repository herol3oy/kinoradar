export type RawShow = {
  title?: string;
  times?: string[];
  link?: string;
  [key: string]: any;
};

export type Show = {
  title: string;
  times: string[];
  cinema: string;
  link?: string;
  source?: string;
  poster?: string;
};

export function normalizeShow(raw: RawShow, cinema: string, source?: string): Show {
  const title = (raw.title || raw.name || 'Unknown').trim();
  const times = Array.isArray(raw.times)
    ? raw.times.map(String).map(t => t.trim()).filter(Boolean)
    : raw.times
    ? [String(raw.times).trim()]
    : [];
  const link = raw.link || raw.url || undefined;
  const poster = raw.poster || undefined;
  return { title, times, cinema, link, source, poster };
}

export function normalizeMany(raws: RawShow[], cinema: string, source?: string) {
  return raws.map(r => normalizeShow(r, cinema, source));
}
