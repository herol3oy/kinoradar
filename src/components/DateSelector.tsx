import { translations, type Locale } from "../i18n/translations";

function formatLabel(date: Date, days: string[]): { day: string; date: string } {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return { day: days[date.getDay()], date: `${day}.${month}` };
}

function toValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDates(days: string[]): { value: string; label: { day: string; date: string } }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { value: toValue(d), label: formatLabel(d, days) };
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
      <div className="grid min-w-[620px] grid-cols-7 gap-2">
        {getDates(t.days).map(({ value, label }, index) => {
          const active = selected === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              aria-pressed={active}
              className={`group relative overflow-hidden border px-3 py-3 text-left transition-all ${
                active
                  ? "border-retro-cyan bg-retro-cyan/10 text-white shadow-[0_0_24px_rgba(0,255,255,0.08)]"
                  : "border-white/8 bg-white/[0.02] text-gray-500 hover:border-white/20 hover:bg-white/[0.04] hover:text-gray-300"
              }`}
            >
              {active && <span className="absolute inset-x-0 top-0 h-px bg-retro-cyan shadow-[0_0_10px_var(--color-retro-cyan)]" />}
              <span className="block text-[10px] tracking-[0.18em] uppercase">{index === 0 ? t.today : label.day}</span>
              <span className={`mt-1 block text-lg font-bold ${active ? "text-retro-cyan" : "text-gray-300"}`}>{label.date}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
