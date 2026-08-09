import { fetchWithTimeout } from '../../server/fetch';
import { parseLanguageCodes } from '../screening-language';

const API_URL = 'https://bilety.kinogram.pl/api/graphql';

const QUERY = `query getScreeningList($query: ScreeningListInput!) {
  getScreeningList(query: $query) {
    ...Screening
    __typename
  }
}

fragment Screening on ScreeningOutput {
  id
  cinemaId
  speakingType
  language
  subtitles
  printType
  screeningTimeFrom
  screeningTimeTo
  soundType
  saleTimeTo
  movie {
    ...ScreeningListMovie
    __typename
  }
  __typename
}

fragment ScreeningListMovie on MovieOutput {
  id
  title
  originalTitle
  country
  yearOfProduction
  posters
  originalLanguage
  trailers
  duration
  genres {
    ...MovieGenre
    __typename
  }
  tagGroups {
    symbol
    tags {
      symbol
      __typename
    }
    __typename
  }
  __typename
}

fragment MovieGenre on GenreOutput {
  id
  name
  __typename
}`;

export async function parseKinogram(date?: string | Date) {
  const day = typeof date === 'string' ? date : date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const dateAt = new Date(day + 'T18:45:00.000Z').toISOString();

  const res = await fetchWithTimeout(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operationName: 'getScreeningList',
      variables: {
        query: {
          dateAt,
          genres: [],
          soundTypes: [],
          printTypes: [],
          isPremiere: false,
        },
      },
      query: QUERY,
    }),
  });

  if (!res.ok) throw new Error(`Kinogram returned ${res.status}`);
  const data = await res.json();
  const screenings = data?.data?.getScreeningList || [];
  const groups: Record<string, any> = {};

  for (const s of screenings) {
    const title = s.movie?.title;
    if (!title) continue;

    const time = new Date(s.screeningTimeFrom).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
    const poster = s.movie?.posters?.[0] || undefined;

    const movieId = s.movie?.id;
    const link = movieId ? `https://bilety.kinogram.pl/screening/movie/${movieId}` : undefined;

    if (!groups[title]) {
      groups[title] = { title, screenings: [], poster, link };
    }
    if (time) {
      const subtitleLanguages = parseLanguageCodes(s.subtitles);
      groups[title].screenings.push({
        time,
        link,
        audioLanguage: s.language || undefined,
        subtitleLanguages,
        subtitled: subtitleLanguages.length > 0,
        dubbed: s.speakingType === 'DUB' ? true : s.speakingType === 'ORG' ? false : undefined,
      });
    }
  }

  return Object.values(groups);
}

export const siteName = 'Kinogram';
