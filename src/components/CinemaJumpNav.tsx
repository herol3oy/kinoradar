import { useEffect, useState, type MouseEvent } from "react";
import { translations, type Locale } from "../i18n/translations";
import type { ShowGroup } from "../lib/group-shows";
import { Badge } from "@/components/ui/badge";

const MIN_GROUPS = 3;

interface Props {
  locale: Locale;
  groups: ShowGroup[];
}

export default function CinemaJumpNav({ locale, groups }: Props) {
  const t = translations[locale].shows;
  const [activeId, setActiveId] = useState<string | null>(null);
  const anchorIds = groups.map((group) => group.anchorId).join("|");
  const enabled = groups.length >= MIN_GROUPS;

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;

    const sections = anchorIds
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) return;
        const closest = visible.reduce((best, entry) =>
          entry.boundingClientRect.top < best.boundingClientRect.top ? entry : best,
        );
        setActiveId(closest.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [anchorIds, enabled]);

  if (!enabled) return null;

  const scrollToGroup = (event: MouseEvent<HTMLAnchorElement>, anchorId: string) => {
    const target = document.getElementById(anchorId);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(anchorId);
  };

  return (
    <nav aria-label={t.jumpTo} className="flex snap-x gap-2 overflow-x-auto pb-3">
      {groups.map((group) => {
        const active = group.anchorId === activeId;
        return (
          <a
            key={group.anchorId}
            href={`#${group.anchorId}`}
            aria-current={active ? "true" : undefined}
            onClick={(event) => scrollToGroup(event, group.anchorId)}
            className={`flex shrink-0 snap-start items-center gap-2 border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {group.heading}
            <Badge variant={active ? "outline" : "secondary"} className="px-1.5 py-0 text-[10px]">{group.filmCount}</Badge>
          </a>
        );
      })}
    </nav>
  );
}
