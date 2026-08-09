export const locales = ["pl", "en"] as const;
export type Locale = (typeof locales)[number];

type CountForms = {
  one: string;
  few: string;
  many: string;
};

export interface Translations {
  meta: { title: string; description: string };
  header: { home: string; tagline: string; online: string; language: string };
  hero: { eyebrow: string; title: string; accent: string; description: string; films: CountForms; cinemas: CountForms };
  date: { heading: string; range: string; nav: string; today: string; days: string[] };
  loading: string;
  status: {
    loadFailed: string;
    updateFailed: string;
    partialResults: string;
    couldNotUpdate: string;
    lastAttempt: string;
    staleResults: string;
    lastUpdated: string;
  };
  filters: {
    aria: string;
    quickPicks: string;
    nextTwoHours: string;
    afterWork: string;
    tonight: string;
    todayOnlyPreset: string;
    search: string;
    searchPlaceholder: string;
    cinema: string;
    allCinemas: string;
    from: string;
    until: string;
    viewBy: string;
    film: string;
    sortBy: string;
    earliest: string;
    title: string;
    startingSoon: string;
    startingSoonHint: string;
    todayOnly: string;
    reset: string;
    inSignal: string;
  };
  shows: {
    filmSignal: string;
    cinemaChannel: string;
    warsawVenue: string;
    buyTickets: string;
    previous: string;
    next: string;
    noFilms: string;
    tryFilters: string;
    loadFailed: string;
    nonePublished: string;
    noMatches: string;
    noneAvailable: string;
  };
  footer: string;
}

export const translations: Record<Locale, Translations> = {
  pl: {
    meta: {
      title: "KinoRadar — repertuar warszawskich kin",
      description: "Repertuar warszawskich kin w jednym miejscu.",
    },
    header: {
      home: "Strona główna KinoRadar",
      tagline: "Sygnał warszawskich kin",
      online: "12 kin online",
      language: "Wybierz język",
    },
    hero: {
      eyebrow: "Aktualny repertuar Warszawy",
      title: "Znajdź swój następny",
      accent: "seans.",
      description: "Repertuary kin studyjnych, zsynchronizowane i przeszukiwalne w jednym miejscu.",
      films: { one: "film", few: "filmy", many: "filmów" },
      cinemas: { one: "kino", few: "kina", many: "kin" },
    },
    date: {
      heading: "Wybierz datę",
      range: "Najbliższe 7 dni",
      nav: "Wybierz datę repertuaru",
      today: "Dzisiaj",
      days: ["Niedz.", "Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob."],
    },
    loading: "Skanowanie repertuarów",
    status: {
      loadFailed: "_BŁĄD_WCZYTYWANIA — WYBIERZ INNĄ DATĘ LUB ODŚWIEŻ STRONĘ.",
      updateFailed: "_BŁĄD_AKTUALIZACJI",
      partialResults: "_CZĘŚCIOWE_WYNIKI",
      couldNotUpdate: "NIE UDAŁO SIĘ ZAKTUALIZOWAĆ",
      lastAttempt: "OSTATNIA PRÓBA",
      staleResults: "_NIEAKTUALNE_WYNIKI — OSTATNIA AKTUALIZACJA",
      lastUpdated: "OSTATNIA AKTUALIZACJA",
    },
    filters: {
      aria: "Filtry filmów",
      quickPicks: "Szybki wybór",
      nextTwoHours: "NAJBLIŻSZE 2 GODZINY",
      afterWork: "PO PRACY",
      tonight: "WIECZOREM",
      todayOnlyPreset: "Opcja najbliższych dwóch godzin jest dostępna tylko dla dzisiejszej daty",
      search: "Szukaj filmów",
      searchPlaceholder: "Zacznij wpisywać tytuł...",
      cinema: "Kino",
      allCinemas: "WSZYSTKIE KINA",
      from: "Od",
      until: "Do",
      viewBy: "Grupuj według",
      film: "Film",
      sortBy: "Sortuj według",
      earliest: "NAJWCZEŚNIEJSZEJ GODZINY",
      title: "TYTUŁU A–Z",
      startingSoon: "START W CIĄGU 2H",
      startingSoonHint: "Pokaż tylko seanse rozpoczynające się w ciągu najbliższych dwóch godzin",
      todayOnly: "Dostępne tylko dla dzisiejszej daty",
      reset: "[ WYCZYŚĆ ]",
      inSignal: "w sygnale",
    },
    shows: {
      filmSignal: "Sygnał filmu",
      cinemaChannel: "Kanał kina",
      warsawVenue: "Warszawskie kino",
      buyTickets: "Kup bilety",
      previous: "Poprzedni slajd",
      next: "Następny slajd",
      noFilms: "Nie znaleziono filmów",
      tryFilters: "Zmień lub wyczyść filtry.",
      loadFailed: "Nie udało się wczytać repertuaru. Spróbuj ponownie.",
      nonePublished: "Dla tej daty nie opublikowano jeszcze repertuaru.",
      noMatches: "Żaden seans nie pasuje do wybranych filtrów.",
      noneAvailable: "Brak dostępnych seansów dla tej daty.",
    },
    footer: "Repertuary należą do poszczególnych kin · Zawsze potwierdź szczegóły przed zakupem",
  },
  en: {
    meta: {
      title: "KinoRadar — Warsaw cinema guide",
      description: "Warsaw cinema schedules, collected in one place.",
    },
    header: {
      home: "KinoRadar home",
      tagline: "Warsaw cinema signal",
      online: "12 cinemas online",
      language: "Choose language",
    },
    hero: {
      eyebrow: "Live Warsaw repertory",
      title: "Find your next",
      accent: "screening.",
      description: "Independent cinema schedules, synchronized and searchable in one signal.",
      films: { one: "film", few: "films", many: "films" },
      cinemas: { one: "cinema", few: "cinemas", many: "cinemas" },
    },
    date: {
      heading: "Select date",
      range: "Next 7 days",
      nav: "Choose schedule date",
      today: "Today",
      days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    loading: "Scanning schedules",
    status: {
      loadFailed: "_SCHEDULE_LOAD_FAILED — PLEASE TRY ANOTHER DATE OR REFRESH.",
      updateFailed: "_SCHEDULE_UPDATE_FAILED",
      partialResults: "_PARTIAL_RESULTS",
      couldNotUpdate: "COULD NOT UPDATE",
      lastAttempt: "LAST ATTEMPT",
      staleResults: "_STALE_RESULTS — LAST UPDATED",
      lastUpdated: "LAST UPDATED",
    },
    filters: {
      aria: "Film filters",
      quickPicks: "Quick picks",
      nextTwoHours: "NEXT 2 HOURS",
      afterWork: "AFTER WORK",
      tonight: "TONIGHT",
      todayOnlyPreset: "The next-two-hours preset is available for today only",
      search: "Search films",
      searchPlaceholder: "Start typing a title...",
      cinema: "Cinema",
      allCinemas: "ALL CINEMAS",
      from: "From",
      until: "Until",
      viewBy: "View by",
      film: "Film",
      sortBy: "Sort by",
      earliest: "EARLIEST TIME",
      title: "TITLE A–Z",
      startingSoon: "STARTING IN 2H",
      startingSoonHint: "Only show screenings starting in the next two hours",
      todayOnly: "Available for today only",
      reset: "[ RESET ]",
      inSignal: "in signal",
    },
    shows: {
      filmSignal: "Film signal",
      cinemaChannel: "Cinema channel",
      warsawVenue: "Warsaw venue",
      buyTickets: "Buy tickets",
      previous: "Previous slide",
      next: "Next slide",
      noFilms: "No films found",
      tryFilters: "Try changing or resetting the filters.",
      loadFailed: "The schedule could not be loaded. Please try again.",
      nonePublished: "No screenings have been published for this date.",
      noMatches: "No screenings match the selected filters.",
      noneAvailable: "No screenings are available for this date.",
    },
    footer: "Schedules belong to their respective cinemas · Always confirm details before booking",
  },
};

export function countLabel(locale: Locale, count: number, forms: CountForms): string {
  const category = new Intl.PluralRules(locale).select(count);
  if (category === "one") return forms.one;
  if (category === "few") return forms.few;
  return forms.many;
}
