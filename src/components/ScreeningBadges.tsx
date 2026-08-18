import { translations, type Locale } from "../i18n/translations";
import type { ScreeningLanguage } from "../lib/screening-language";
import { Badge } from "@/components/ui/badge";

export function screeningBadgeLabels(locale: Locale, screening: ScreeningLanguage): string[] {
  const t = translations[locale].screeningLanguage;
  const labels: string[] = [];
  const audio = screening.audioLanguage?.toLocaleUpperCase("en");
  const subtitles = screening.subtitleLanguages?.map((code) => code.toLocaleUpperCase("en"));

  if (screening.dubbed) {
    labels.push(audio ? `${audio} ${t.dubbed}` : t.dubbed);
  } else if (audio) {
    labels.push(`${audio} ${t.audio}`);
  }

  if (subtitles?.length) {
    labels.push(`${subtitles.join("+")} ${t.subtitles}`);
  } else if (screening.subtitled) {
    labels.push(t.subtitled);
  }

  return labels;
}

export default function ScreeningBadges({ locale, screening }: { locale: Locale; screening: ScreeningLanguage }) {
  const labels = screeningBadgeLabels(locale, screening);
  if (!labels.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <Badge key={label} variant="secondary" className="h-5 px-1.5 text-xs font-medium">
          {label}
        </Badge>
      ))}
    </span>
  );
}
