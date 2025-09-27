import { writable, get } from 'svelte/store';
import type { LibraryMovie } from '$lib/types/library';

export type Movie = {
  id: string;
  title: string;
  posterPath: string;
  backdropPath: string;
  overview: string;
  releaseDate: string;
  rating: number;
  genres: string[];
  trailerUrl?: string;
};

type WatchlistCandidate = LibraryMovie | Movie | (Partial<Movie> & Record<string, unknown>);

interface WatchlistState {
  watchlist: Movie[];
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'meatflicks.watchlist';
const hasStorage = typeof localStorage !== 'undefined';

const sanitizeMovie = (candidate: unknown): Movie | null => {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const payload = candidate as Partial<Movie> & Record<string, unknown>;
  const id = typeof payload.id === 'string' ? payload.id : String(payload.id ?? '');
  const title = typeof payload.title === 'string' ? payload.title : String(payload.title ?? '');

  if (!id) {
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
    trailerUrl: typeof payload.trailerUrl === 'string' ? payload.trailerUrl : undefined
  } satisfies Movie;
};

const readStorage = (): Movie[] => {
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
      .map(sanitizeMovie)
      .filter((movie): movie is Movie => Boolean(movie))
      .reduce<Movie[]>((accumulator, movie) => {
        return accumulator.some((existing) => existing.id === movie.id)
          ? accumulator
          : [...accumulator, movie];
      }, []);
  } catch (error) {
    console.error('[watchlist][readStorage] Failed to parse persisted data', error);
    return [];
  }
};

const persist = (watchlist: Movie[]) => {
  if (!hasStorage) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  } catch (error) {
    console.error('[watchlist][persist] Failed to write data', error);
  }
};

function createWatchlistStore() {
  const initialState: WatchlistState = {
    watchlist: [],
    loading: false,
    error: null
  };

  const store = writable<WatchlistState>(initialState);

  const syncFromStorage = () => {
    const stored = readStorage();
    store.update((state) => ({ ...state, watchlist: stored, loading: false, error: null }));
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

  const addToWatchlist = (movie: WatchlistCandidate) => {
    const sanitized = sanitizeMovie(movie);

    if (!sanitized) {
      setError('Unable to add movie to watchlist. Missing required fields.');
      return;
    }

    store.update((state) => {
      const exists = state.watchlist.some((item) => item.id === sanitized.id);
      const updated = exists
        ? state.watchlist.map((item) => (item.id === sanitized.id ? sanitized : item))
        : [...state.watchlist, sanitized];

      persist(updated);
      return { ...state, watchlist: updated, error: null };
    });
  };

  const removeFromWatchlist = (movieId: string) => {
    if (!movieId) {
      setError('Movie id is required to remove from watchlist.');
      return;
    }

    store.update((state) => {
      const updated = state.watchlist.filter((movie) => movie.id !== movieId);
      persist(updated);
      return { ...state, watchlist: updated, error: null };
    });
  };

  const isInWatchlist = (movieId: string) => get(store).watchlist.some((movie) => movie.id === movieId);

  const replaceAll = (movies: Movie[]) => {
    const sanitized = movies
      .map(sanitizeMovie)
      .filter((movie): movie is Movie => Boolean(movie));

    const deduped = sanitized.reduce<Movie[]>((accumulator, movie) => {
      return accumulator.some((existing) => existing.id === movie.id)
        ? accumulator
        : [...accumulator, movie];
    }, []);

    store.update((state) => ({ ...state, watchlist: deduped, error: null }));
    persist(deduped);
  };

  const clear = () => {
    store.set({ ...initialState });
    persist([]);
  };

  const exportData = () => structuredClone(get(store).watchlist);

  return {
    subscribe: store.subscribe,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    replaceAll,
    clear,
    exportData,
    clearError,
    setError
  };
}

export const watchlist = createWatchlistStore();
