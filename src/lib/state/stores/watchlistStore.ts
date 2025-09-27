import { writable, get } from 'svelte/store';

type Movie = {
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

interface WatchlistState {
  watchlist: Movie[];
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const initialState: WatchlistState = {
  watchlist: [],
  loading: false,
  error: null,
  isAuthenticated: false
};

function createWatchlistStore() {
  const store = writable<WatchlistState>(initialState);

  const setAuthStatus = (status: boolean) => {
    store.update((state) => ({ ...state, isAuthenticated: status }));

    if (status) {
      void fetchWatchlist();
    } else {
      store.set({ ...initialState });
    }
  };

  const fetchWatchlist = async () => {
    if (!get(store).isAuthenticated) {
      store.update((state) => ({ ...state, watchlist: [], loading: false }));
      return;
    }

    store.update((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await fetch('/api/watchlist/get');
      if (!response.ok) {
        throw new Error('Failed to fetch watchlist');
      }

      const payload = await response.json();
      const watchlist = Array.isArray(payload.watchlist) ? payload.watchlist : [];

      store.update((state) => ({
        ...state,
        watchlist,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
      store.update((state) => ({
        ...state,
        watchlist: [],
        loading: false,
        error: 'Failed to load watchlist.'
      }));
    }
  };

  const mutateWatchlist = async (endpoint: string, movieId: string) => {
    if (!get(store).isAuthenticated) {
      store.update((state) => ({
        ...state,
        error: 'Please sign in to manage your watchlist.'
      }));
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message ?? 'Failed to update watchlist.');
      }

      await fetchWatchlist();
    } catch (error) {
      console.error('Failed to update watchlist:', error);
      store.update((state) => ({
        ...state,
        error: error instanceof Error ? error.message : 'Failed to update watchlist.'
      }));
    }
  };

  const addToWatchlist = async (movieId: string) => mutateWatchlist('/api/watchlist/add', movieId);

  const removeFromWatchlist = async (movieId: string) => mutateWatchlist('/api/watchlist/remove', movieId);

  const isInWatchlist = (movieId: string) =>
    get(store).watchlist.some((movie) => movie.id === movieId);

  return {
    subscribe: store.subscribe,
    setAuthStatus,
    fetchWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist
  };
}

export const watchlist = createWatchlistStore();



