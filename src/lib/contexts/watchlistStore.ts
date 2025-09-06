import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Define a simple Movie type for now, assuming it will be properly defined elsewhere
type Movie = { id: string; /* ... other movie properties */ };

interface WatchlistStore {
  watchlist: Movie[];
  loading: boolean;
  error: string | null;
  addToWatchlist: (movieId: string) => Promise<void>;
  removeFromWatchlist: (movieId: string) => Promise<void>;
  isInWatchlist: (movieId: string) => boolean;
}

function createWatchlistStore() {
  const { subscribe, set, update } = writable<WatchlistStore>({
    watchlist: [],
    loading: true,
    error: null,
    addToWatchlist: async () => {},
    removeFromWatchlist: async () => {},
    isInWatchlist: () => false,
  });

  let isAuthenticated = false; // Placeholder for authentication status

  // Function to set authentication status (will be called from layout or similar)
  const setAuthStatus = (status: boolean) => {
    isAuthenticated = status;
    if (isAuthenticated) {
      fetchWatchlist();
    } else {
      set({
        watchlist: [],
        loading: false,
        error: null,
        addToWatchlist: async () => {},
        removeFromWatchlist: async () => {},
        isInWatchlist: () => false,
      });
    }
  };

  const fetchWatchlist = async () => {
    if (!isAuthenticated) {
      update((state) => ({ ...state, loading: false, watchlist: [] }));
      return;
    }
    update((state) => ({ ...state, loading: true, error: null }));
    try {
      const response = await fetch('/api/watchlist/get');
      if (!response.ok) {
        throw new Error('Failed to fetch watchlist');
      }
      const data = await response.json();
      update((state) => ({ ...state, watchlist: data, loading: false, error: null }));
    } catch (err) {
      console.error("Failed to fetch watchlist:", err);
      update((state) => ({ ...state, error: "Failed to load watchlist.", loading: false, watchlist: [] }));
    }
  };

  const addToWatchlist = async (movieId: string) => {
    if (!isAuthenticated) {
      update((state) => ({ ...state, error: "Please sign in to manage your watchlist." }));
      return;
    }
    try {
      const response = await fetch('/api/watchlist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ movieId }),
      });
      if (!response.ok) {
        throw new Error('Failed to add to watchlist');
      }
      update((state) => {
        const movieToAdd = { id: movieId } as Movie;
        return { ...state, watchlist: [...state.watchlist, movieToAdd], error: null };
      });
    } catch (err) {
      console.error("Failed to add to watchlist:", err);
      update((state) => ({ ...state, error: "Failed to add to watchlist." }));
    }
  };

  const removeFromWatchlist = async (movieId: string) => {
    if (!isAuthenticated) {
      update((state) => ({ ...state, error: "Please sign in to manage your watchlist." }));
      return;
    }
    try {
      const response = await fetch('/api/watchlist/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ movieId }),
      });
      if (!response.ok) {
        throw new Error('Failed to remove from watchlist');
      }
      update((state) => ({ ...state, watchlist: state.watchlist.filter((movie) => movie.id !== movieId), error: null }));
    } catch (err) {
      console.error("Failed to remove from watchlist:", err);
      update((state) => ({ ...state, error: "Failed to remove from watchlist." }));
    }
  };

  const isInWatchlist = (movieId: string) => {
    let isPresent = false;
    update((state) => {
      isPresent = state.watchlist.some((movie) => movie.id === movieId);
      return state;
    });
    return isPresent;
  };

  // Initial fetch if already authenticated (e.g., on page load after SSR)
  if (browser && isAuthenticated) {
    fetchWatchlist();
  }

  return {
    subscribe,
    setAuthStatus,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    fetchWatchlist, // Expose fetchWatchlist for manual refresh if needed
  };
}

export const watchlist = createWatchlistStore();