import type { ReactNode } from "react";
import { translations, type Locale } from "../i18n/translations";
import { cn } from "@/lib/utils";

interface Props {
  locale: Locale;
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
  zoom?: boolean;
}

export default function Poster({ locale, src, alt = "", className, fallback, zoom = true }: Props) {
  const t = translations[locale].releases;

  return (
    <div
      data-slot="poster"
      className={cn("relative aspect-[2/3] w-full overflow-hidden bg-muted", className)}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          width="500"
          height="750"
          loading="lazy"
          className={cn(
            "size-full object-cover object-center",
            zoom && "transition-transform duration-300 group-hover/card:scale-105",
          )}
        />
      ) : (
        <div className="grid size-full place-items-center p-3 text-center text-xs text-muted-foreground">
          {fallback ?? t.noPoster}
        </div>
      )}
    </div>
  );
}
