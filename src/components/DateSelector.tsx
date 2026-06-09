const DAYS = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];

function formatLabel(date: Date): string {
  const dayOfWeek = DAYS[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${dayOfWeek}, ${day}.${month} [${year}-${month}-${day}]`;
}

function toValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDates(): { value: string; label: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { value: toValue(d), label: formatLabel(d) };
  });
}

interface Props {
  selected: string;
  onChange: (date: string) => void;
}

export default function DateSelector({ selected, onChange }: Props) {
  return (
    <div className="mb-6">
      <label htmlFor="film-date" className="text-sm tracking-widest uppercase text-retro-cyan mr-2">
        [_SELECT_DATE]:
      </label>
      <select
        id="film-date"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="bg-retro-card border border-retro-border text-gray-300 text-sm px-3 py-1.5 uppercase tracking-wider focus:outline-none focus:border-retro-cyan cursor-pointer"
      >
        {getDates().map(({ value, label }) => (
          <option key={value} value={value} className="bg-retro-card text-gray-300">
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
