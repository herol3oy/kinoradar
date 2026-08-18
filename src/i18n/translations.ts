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
    englishFriendly: string;
    englishFriendlyHint: string;
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
  screeningLanguage: {
    audio: string;
    subtitles: string;
    subtitled: string;
    dubbed: string;
  };
  ticketAvailability: {
    loading: string;
    checkingAvailability: string;
    from: string;
    booked: string;
    prices: string;
    priceUnavailable: string;
    availabilityUnavailable: string;
    seatsAvailable: string;
    saleUnavailable: string;
    soldOut: string;
  };
  footer: string;
  cinemaPage: {
    eyebrow: string;
    schedule: string;
    description: string;
    cinemas: string;
    home: string;
  };
  favorites: {
    nav: string;
    title: string;
    eyebrow: string;
    description: string;
    add: string;
    remove: string;
    limit: string;
    empty: string;
    emptyDescription: string;
    browse: string;
    clear: string;
    copyLink: string;
    copied: string;
    copyFailed: string;
    sharedTitle: string;
    sharedDescription: string;
    loading: string;
    unavailable: string;
    invalid: string;
    date: string;
  };
  filmPage: {
    eyebrow: string;
    description: string;
    allScreenings: string;
    cinemas: string;
    noScreenings: string;
    noScreeningsDescription: string;
    loadFailed: string;
    partialResults: string;
  };
  releases: {
    nav: string;
    title: string;
    accent: string;
    eyebrow: string;
    description: string;
    filters: string;
    search: string;
    searchPlaceholder: string;
    genre: string;
    allGenres: string;
    reset: string;
    releaseDate: string;
    details: string;
    noPoster: string;
    loading: string;
    loadMore: string;
    loadFailed: string;
    retry: string;
    empty: string;
    emptyDescription: string;
    stale: string;
    attribution: string;
  };
  popular: {
    eyebrow: string;
    title: string;
    accent: string;
    nextScreening: string;
    laterToday: string;
    attribution: string;
  };
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
      online: "23 kina online",
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
      englishFriendly: "PO ANGIELSKU",
      englishFriendlyHint: "Pokaż seanse ze zweryfikowanym angielskim dźwiękiem lub napisami",
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
    screeningLanguage: {
      audio: "dźwięk",
      subtitles: "napisy",
      subtitled: "napisy",
      dubbed: "dubbing",
    },
    ticketAvailability: {
      loading: "Sprawdzanie cen i rezerwacji",
      checkingAvailability: "Sprawdzanie dostępności",
      from: "od",
      booked: "zarezerwowane miejsca",
      prices: "Ceny biletów",
      priceUnavailable: "Cena niedostępna",
      availabilityUnavailable: "Dostępność niedostępna",
      seatsAvailable: "wolnych miejsc",
      saleUnavailable: "Sprzedaż niedostępna",
      soldOut: "Brak miejsc",
    },
    footer: "Repertuary należą do poszczególnych kin · Zawsze potwierdź szczegóły przed zakupem",
    cinemaPage: {
      eyebrow: "Kino w Warszawie",
      schedule: "repertuar",
      description: "Sprawdź repertuar, godziny seansów i bilety na najbliższe 7 dni.",
      cinemas: "Kina",
      home: "Strona główna",
    },
    favorites: {
      nav: "Ulubione",
      title: "Ulubione filmy",
      eyebrow: "Twoja lista",
      description: "Zapisane filmy i dostępne seanse w warszawskich kinach.",
      add: "Dodaj do ulubionych",
      remove: "Usuń z ulubionych",
      limit: "Możesz zapisać maksymalnie 20 filmów.",
      empty: "Brak ulubionych filmów",
      emptyDescription: "Oznacz filmy gwiazdką, a pojawią się na tej liście.",
      browse: "Przeglądaj repertuar",
      clear: "Wyczyść listę",
      copyLink: "Kopiuj link",
      copied: "Link skopiowany",
      copyFailed: "Nie udało się skopiować linku",
      sharedTitle: "Udostępniona lista filmów",
      sharedDescription: "Filmy wybrane do wspólnego seansu.",
      loading: "Wczytywanie seansów",
      unavailable: "Brak aktualnych seansów dla zapisanej daty.",
      invalid: "Ten link do listy jest nieprawidłowy lub nieaktualny.",
      date: "Data",
    },
    filmPage: {
      eyebrow: "Wszystkie seanse filmu",
      description: "Porównaj wszystkie dostępne godziny i kina dla wybranej daty.",
      allScreenings: "Wszystkie seanse",
      cinemas: "Dostępne kina",
      noScreenings: "Brak seansów tego filmu",
      noScreeningsDescription: "Wybierz inną datę, aby sprawdzić kolejne seanse.",
      loadFailed: "Nie udało się wczytać seansów. Spróbuj ponownie.",
      partialResults: "Niektórych kin nie udało się zaktualizować. Wyniki mogą być niepełne.",
    },
    releases: {
      nav: "Premiery",
      title: "Nadchodzące",
      accent: "premiery.",
      eyebrow: "Kalendarz premier w Polsce",
      description: "Filmy z zapowiedzianą polską premierą kinową, pogrupowane według daty.",
      filters: "Filtry premier",
      search: "Szukaj filmów",
      searchPlaceholder: "Tytuł polski lub oryginalny...",
      genre: "Gatunek",
      allGenres: "WSZYSTKIE GATUNKI",
      reset: "[ WYCZYŚĆ ]",
      releaseDate: "Data premiery",
      details: "Szczegóły filmu",
      noPoster: "Brak plakatu",
      loading: "Skanowanie premier",
      loadMore: "Pokaż kolejne daty",
      loadFailed: "Nie udało się wczytać premier.",
      retry: "Spróbuj ponownie",
      empty: "Brak pasujących premier",
      emptyDescription: "Zmień lub wyczyść filtry, aby zobaczyć więcej filmów.",
      stale: "_NIEAKTUALNE_DANE — OSTATNIA AKTUALIZACJA",
      attribution: "Ten produkt korzysta z API TMDB, ale nie jest wspierany ani certyfikowany przez TMDB.",
    },
    popular: {
      eyebrow: "Najpopularniejsze na Filmwebie",
      title: "Najpopularniejsze",
      accent: "seanse.",
      nextScreening: "Najbliższy seans",
      laterToday: "Seans dzisiaj",
      attribution: "Ranking popularności: Filmweb.",
    },
  },
  en: {
    meta: {
      title: "KinoRadar — Warsaw cinema guide",
      description: "Warsaw cinema schedules, collected in one place.",
    },
    header: {
      home: "KinoRadar home",
      tagline: "Warsaw cinema signal",
      online: "23 cinemas online",
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
      englishFriendly: "ENGLISH-FRIENDLY",
      englishFriendlyHint: "Show screenings with verified English audio or subtitles",
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
    screeningLanguage: {
      audio: "audio",
      subtitles: "subtitles",
      subtitled: "subtitled",
      dubbed: "dubbed",
    },
    ticketAvailability: {
      loading: "Checking prices and bookings",
      checkingAvailability: "Checking availability",
      from: "from",
      booked: "booked",
      prices: "Ticket prices",
      priceUnavailable: "Price unavailable",
      availabilityUnavailable: "Availability unavailable",
      seatsAvailable: "seats available",
      saleUnavailable: "Sales unavailable",
      soldOut: "Sold out",
    },
    footer: "Schedules belong to their respective cinemas · Always confirm details before booking",
    cinemaPage: {
      eyebrow: "Warsaw cinema",
      schedule: "schedule",
      description: "Browse screening times and ticket links for the next 7 days.",
      cinemas: "Cinemas",
      home: "Home",
    },
    favorites: {
      nav: "Favorites",
      title: "Favorite films",
      eyebrow: "Your list",
      description: "Your saved films and available screenings in Warsaw cinemas.",
      add: "Add to favorites",
      remove: "Remove from favorites",
      limit: "You can save up to 20 films.",
      empty: "No favorite films yet",
      emptyDescription: "Select the star on a film card and it will appear here.",
      browse: "Browse schedules",
      clear: "Clear list",
      copyLink: "Copy link",
      copied: "Link copied",
      copyFailed: "Could not copy the link",
      sharedTitle: "Shared film list",
      sharedDescription: "Films selected for a cinema trip together.",
      loading: "Loading screenings",
      unavailable: "No current screenings for the saved date.",
      invalid: "This shared-list link is invalid or out of date.",
      date: "Date",
    },
    filmPage: {
      eyebrow: "All film screenings",
      description: "Compare every available time and cinema for the selected date.",
      allScreenings: "All screenings",
      cinemas: "Available cinemas",
      noScreenings: "No screenings for this film",
      noScreeningsDescription: "Choose another date to check upcoming screenings.",
      loadFailed: "Screenings could not be loaded. Please try again.",
      partialResults: "Some cinemas could not be updated. Results may be incomplete.",
    },
    releases: {
      nav: "Releases",
      title: "Upcoming",
      accent: "releases.",
      eyebrow: "Polish release calendar",
      description: "Movies with an announced Polish theatrical release, grouped by release date.",
      filters: "Release filters",
      search: "Search films",
      searchPlaceholder: "Localized or original title...",
      genre: "Genre",
      allGenres: "ALL GENRES",
      reset: "[ RESET ]",
      releaseDate: "Release date",
      details: "Film details",
      noPoster: "No poster",
      loading: "Scanning releases",
      loadMore: "Show more dates",
      loadFailed: "Upcoming releases could not be loaded.",
      retry: "Try again",
      empty: "No matching releases",
      emptyDescription: "Try changing or resetting the filters to see more films.",
      stale: "_STALE_DATA — LAST UPDATED",
      attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    },
    popular: {
      eyebrow: "Most popular on Filmweb",
      title: "Most popular",
      accent: "screenings.",
      nextScreening: "Next screening",
      laterToday: "Screening today",
      attribution: "Popularity ranking by Filmweb.",
    },
  },
};

export function countLabel(locale: Locale, count: number, forms: CountForms): string {
  const category = new Intl.PluralRules(locale).select(count);
  if (category === "one") return forms.one;
  if (category === "few") return forms.few;
  return forms.many;
}
