import { translations, type Locale } from "../i18n/translations";
import { warsawDateRange } from "../lib/warsaw-date";
import { Button } from "@/components/ui/button";

function getDates(days: string[]): { value: string; label: { day: string; date: string } }[] {
  return warsawDateRange(7).map((value) => {
    const [, month, day] = value.split("-");
    const weekday = new Date(`${value}T00:00:00Z`).getUTCDay();
    return { value, label: { day: days[weekday], date: `${day}.${month}` } };
  });
}

interface Props {
  locale: Locale;
  selected: string;
  onChange: (date: string) => void;
}

export default function DateSelector({ locale, selected, onChange }: Props) {
  const t = translations[locale].date;
  return (
    <nav aria-label={t.nav} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="grid min-w-2xl grid-cols-7 gap-2">
        {getDates(t.days).map(({ value, label }, index) => {
          const active = selected === value;
          return (
            <Button
              key={value}
              type="button"
              variant={active ? "default" : "outline"}
              className="h-auto min-h-16 flex-col items-start gap-1 px-3 py-3 text-left"
              onClick={() => onChange(value)}
              aria-pressed={active}
            >
              <span className="text-xs font-medium">{index === 0 ? t.today : label.day}</span>
              <span className="font-heading text-base font-semibold">{label.date}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
