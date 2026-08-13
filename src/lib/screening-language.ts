export type ScreeningLanguage = {
  audioLanguage?: string;
  subtitleLanguages?: string[];
  subtitled?: boolean;
  dubbed?: boolean;
};

export type ScreeningProviderRef =
  | { provider: "kinoteka"; screeningId: string }
  | { provider: "kinokultura"; screeningId: string }
  | { provider: "novekino"; cinema: "wisla" | "atlantic"; screeningId: string }
  | {
      provider: "multikino";
      cinema: "reduta" | "mlociny" | "targowek" | "wola-park" | "zlote-tarasy";
      screeningId: string;
    };

export type ScreeningPresentation = {
  printType?: string;
  soundType?: string;
  format?: string;
  screenFeatures?: string[];
};

export type Screening = ScreeningLanguage & {
  time: string;
  link?: string;
  providerRef?: ScreeningProviderRef;
  presentation?: ScreeningPresentation;
};

export type ParsedScreeningTitle = {
  canonicalTitle: string;
  language: ScreeningLanguage;
};

const EXPLICIT_LANGUAGE_SUFFIX = /\s*\[(napisy|dubbing)\s+([^\]]+)\]\s*$/iu;
const GENERIC_LANGUAGE_SUFFIX = /\s+-\s*(napisy|dubbing)\s*$/iu;

export function normalizeLanguageCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toLocaleLowerCase("en");
  return /^[a-z]{2}$/.test(code) ? code : undefined;
}

export function parseLanguageCodes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap(parseLanguageCodes))].sort();
  }
  if (typeof value !== "string") return [];
  return [...new Set(
    value
      .split(/[^\p{Letter}]+/u)
      .map(normalizeLanguageCode)
      .filter((code): code is string => Boolean(code)),
  )].sort();
}

export function parseScreeningTitle(value: string): ParsedScreeningTitle {
  const title = value.trim();
  const explicit = EXPLICIT_LANGUAGE_SUFFIX.exec(title);
  if (explicit) {
    const kind = explicit[1].toLocaleLowerCase("pl");
    const languages = parseLanguageCodes(explicit[2]);
    const canonicalTitle = title.slice(0, explicit.index).trim() || title;
    return kind === "napisy"
      ? { canonicalTitle, language: { subtitled: true, subtitleLanguages: languages } }
      : { canonicalTitle, language: { dubbed: true, audioLanguage: languages[0] } };
  }

  const generic = GENERIC_LANGUAGE_SUFFIX.exec(title);
  if (generic) {
    const kind = generic[1].toLocaleLowerCase("pl");
    const canonicalTitle = title.slice(0, generic.index).trim() || title;
    return kind === "napisy"
      ? { canonicalTitle, language: { subtitled: true } }
      : { canonicalTitle, language: { dubbed: true } };
  }

  return { canonicalTitle: title, language: {} };
}

export function normalizeScreeningLanguage(
  value: ScreeningLanguage,
  fallback: ScreeningLanguage = {},
): ScreeningLanguage {
  const audioLanguage = normalizeLanguageCode(value.audioLanguage)
    ?? normalizeLanguageCode(fallback.audioLanguage);
  const subtitleLanguages = value.subtitleLanguages !== undefined
    ? parseLanguageCodes(value.subtitleLanguages)
    : fallback.subtitleLanguages !== undefined
      ? parseLanguageCodes(fallback.subtitleLanguages)
      : undefined;
  const subtitled = value.subtitled !== undefined
    ? value.subtitled
    : fallback.subtitled !== undefined
      ? fallback.subtitled
      : subtitleLanguages?.length
        ? true
        : undefined;

  return {
    ...(audioLanguage ? { audioLanguage } : {}),
    ...(subtitleLanguages !== undefined ? { subtitleLanguages } : {}),
    ...(subtitled !== undefined ? { subtitled } : {}),
    ...(value.dubbed !== undefined
      ? { dubbed: value.dubbed }
      : fallback.dubbed !== undefined
        ? { dubbed: fallback.dubbed }
        : {}),
  };
}

export function screeningFingerprint(screening: Screening): string {
  const subtitles = [...(screening.subtitleLanguages ?? [])].sort().join(",");
  const subtitled = screening.subtitled === undefined ? "?" : screening.subtitled ? "1" : "0";
  const dubbed = screening.dubbed === undefined ? "?" : screening.dubbed ? "1" : "0";
  return `${screening.time.trim()}|${screening.audioLanguage ?? ""}|${subtitles}|${subtitled}|${dubbed}`;
}

export function screeningIdentity(screening: Screening): string {
  if (screening.providerRef?.provider === "novekino" || screening.providerRef?.provider === "multikino") {
    return `${screening.providerRef.provider}:${screening.providerRef.cinema}:${screening.providerRef.screeningId}`;
  }
  return screening.providerRef
    ? `${screening.providerRef.provider}:${screening.providerRef.screeningId}`
    : screeningFingerprint(screening);
}

export function isEnglishFriendly(screening: Screening): boolean {
  return screening.audioLanguage === "en"
    || screening.subtitleLanguages?.includes("en") === true;
}
