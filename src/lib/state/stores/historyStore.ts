import { writable, get } from 'svelte/store';
import type { Movie } from './watchlistStore';

export type HistoryEntry = Movie & {
  watchedAt: string;
  mediaType?: string;
};

type HistoryState = {
  entries: HistoryEntry[];
  error: string | null;
};

const STORAGE_KEY = 'meatflicks.history';
const hasStorage = typeof localStorage !== 'undefined';

const sanitizeEntry = (candidate: unknown): HistoryEntry | null => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const payload = candidate as Partial<HistoryEntry> & Record<string, unknown>;
  const id = typeof payload.id === 'string' ? payload.id : String(payload.id ?? '');
  const title = typeof payload.title === 'string' ? payload.title : String(payload.title ?? '');
  const watchedAt = typeof payload.watchedAt === 'string' ? payload.watchedAt : String(payload.watchedAt ?? '');

  if (!id || !watchedAt) {
    return null;
  }

  const ratingValue = Number(payload.rating ?? 0);

  return {
    id,
    title,
    posterPath: typeof payload.posterPath === 'string' ? payload.posterPath : '',
    backdropPath: typeof payload.backdropPath === 'string' ? payload.backdropPath : '',
    overview: typeof payload.overview === 'string' ? payload.overview : '',
    releaseDate: typeof payload.releaseDate === 'string' ? payload.releaseDate : '',
    rating: Number.isFinite(ratingValue) ? ratingValue : 0,
    genres: Array.isArray(payload.genres) ? payload.genres.map(String) : [],
    trailerUrl: typeof payload.trailerUrl === 'string' ? payload.trailerUrl : undefined,
    watchedAt,
    mediaType: typeof payload.mediaType === 'string' ? payload.mediaType : undefined
  } satisfies HistoryEntry;
};

const readStorage = (): HistoryEntry[] => {
  if (!hasStorage) {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizeEntry)
      .filter((entry): entry is HistoryEntry => Boolean(entry))
      .sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));
  } catch (error) {
    console.error('[history][readStorage] Failed to parse persisted data', error);
    return [];
  }
};

const persist = (entries: HistoryEntry[]) => {
  if (!hasStorage) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('[history][persist] Failed to write data', error);
  }
};

const normalizeForHistory = (movie: Partial<Movie> & Record<string, unknown>): HistoryEntry | null => {
  const id = typeof movie.id === 'string' ? movie.id : String(movie.id ?? '');
  const title = typeof movie.title === 'string' ? movie.title : String(movie.title ?? '');

  if (!id || !title) {
    return null;
  }

  const ratingValue = Number(movie.rating ?? 0);
  const timestamp = new Date().toISOString();

  return {
    id,
    title,
    posterPath: typeof movie.posterPath === 'string' ? movie.posterPath : '',
    backdropPath: typeof movie.backdropPath === 'string' ? movie.backdropPath : '',
    overview: typeof movie.overview === 'string' ? movie.overview : '',
    releaseDate: typeof movie.releaseDate === 'string' ? movie.releaseDate : '',
    rating: Number.isFinite(ratingValue) ? ratingValue : 0,
    genres: Array.isArray(movie.genres) ? movie.genres.map(String) : [],
    trailerUrl: typeof movie.trailerUrl === 'string' ? movie.trailerUrl : undefined,
    watchedAt: timestamp,
    mediaType: typeof movie.media_type === 'string' ? (movie.media_type as string) : undefined
  } satisfies HistoryEntry;
};

function createHistoryStore() {
  const initialState: HistoryState = {
    entries: [],
    error: null
  };

  const store = writable<HistoryState>(initialState);

  const syncFromStorage = () => {
    const stored = readStorage();
    store.update((state) => ({ ...state, entries: stored, error: null }));
  };

  if (hasStorage && typeof window !== 'undefined') {
    syncFromStorage();
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        syncFromStorage();
      }
    });
  }

  const setError = (message: string) => {
    store.update((state) => ({ ...state, error: message }));
  };

  const clearError = () => {
    store.update((state) => ({ ...state, error: null }));
  };

  const recordWatch = (movie: Partial<Movie> & Record<string, unknown>) => {
    const entry = normalizeForHistory(movie);

    if (!entry) {
      setError('Unable to record history entry. Movie is missing required data.');
      return;
    }

    store.update((state) => {
      const filtered = state.entries.filter((existing) => existing.id !== entry.id);
      const updated = [entry, ...filtered].sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));
      persist(updated);
      return { ...state, entries: updated, error: null };
    });
  };

  const remove = (movieId: string) => {
    if (!movieId) {
      setError('Movie id is required to remove history entry.');
      return;
    }

    store.update((state) => {
      const updated = state.entries.filter((entry) => entry.id !== movieId);
      persist(updated);
      return { ...state, entries: updated, error: null };
    });
  };

  const replaceAll = (entries: HistoryEntry[]) => {
    const sanitized = entries
      .map(sanitizeEntry)
      .filter((entry): entry is HistoryEntry => Boolean(entry))
      .sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));

    store.update((state) => ({ ...state, entries: sanitized, error: null }));
    persist(sanitized);
  };

  const clear = () => {
    store.set({ ...initialState });
    persist([]);
  };

  const exportData = () => structuredClone(get(store).entries);

  return {
    subscribe: store.subscribe,
    recordWatch,
    remove,
    replaceAll,
    clear,
    exportData,
    clearError,
    setError
  };
}

export const watchHistory = createHistoryStore();
