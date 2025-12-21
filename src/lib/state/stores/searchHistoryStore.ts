import { writable, get } from 'svelte/store';

interface SearchHistoryItem {
	id: number;
	query: string;
	searchedAt: number;
	filters?: any;
}

interface SearchHistoryState {
	history: SearchHistoryItem[];
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'meatflicks.searchHistory';
const hasStorage = typeof localStorage !== 'undefined';

const readStorage = (): SearchHistoryItem[] => {
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
			.filter((item): item is SearchHistoryItem => {
				return item && typeof item === 'object' &&
					typeof item.query === 'string' &&
					typeof item.searchedAt === 'number';
			})
			.sort((a, b) => b.searchedAt - a.searchedAt);
	} catch (error) {
		console.error('[searchHistory][readStorage] Failed to parse persisted data', error);
		return [];
	}
};

const persist = (history: SearchHistoryItem[]) => {
	if (!hasStorage) {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
	} catch (error) {
		console.error('[searchHistory][persist] Failed to write data', error);
	}
};

function createSearchHistoryStore() {
	const initialState: SearchHistoryState = {
		history: [],
		loading: false,
		error: null
	};

	const store = writable<SearchHistoryState>(initialState);

	const syncFromServer = async () => {
		if (typeof window === 'undefined') return;

		store.update((state) => ({ ...state, loading: true }));
		try {
			const response = await fetch('/api/search/history', {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				const serverHistory = data.searches || [];

				// If server returns history, use it (authenticated user)
				if (serverHistory.length > 0) {
					store.update((state) => ({
						...state,
						history: serverHistory,
						loading: false,
						error: null
					}));
					persist(serverHistory);
				} else {
					// Server returned empty array (unauthenticated user), use local storage
					const stored = readStorage();
					store.update((state) => ({
						...state,
						history: stored,
						loading: false,
						error: null
					}));
				}
			} else {
				// Fallback to local storage if server fails
				const stored = readStorage();
				store.update((state) => ({
					...state,
					history: stored,
					loading: false,
					error: null
				}));
			}
		} catch (error) {
			console.error('[searchHistory][syncFromServer] Failed', error);
			// Fallback to local storage if server fails
			const stored = readStorage();
			store.update((state) => ({
				...state,
				history: stored,
				loading: false,
				error: null
			}));
		}
	};

	if (typeof window !== 'undefined') {
		syncFromServer();
		window.addEventListener('storage', (event) => {
			if (event.key === STORAGE_KEY) {
				const stored = readStorage();
				store.update((state) => ({ ...state, history: stored }));
			}
		});
	}

	const setError = (message: string) => {
		store.update((state) => ({ ...state, error: message }));
	};

	const clearError = () => {
		store.update((state) => ({ ...state, error: null }));
	};

	const addSearch = async (query: string, filters?: any) => {
		if (!query.trim()) {
			return;
		}

		const newItem: SearchHistoryItem = {
			id: Date.now(),
			query: query.trim(),
			searchedAt: Date.now(),
			filters
		};

		// Optimistic update
		store.update((state) => {
			// Remove duplicate queries
			const updated = state.history.filter(item => item.query !== newItem.query);
			// Add new item at the beginning
			const final = [newItem, ...updated].slice(0, 50); // Keep max 50 items
			persist(final);
			return { ...state, history: final, error: null };
		});

		// Try to sync with server (will succeed for authenticated users, fail silently for unauthenticated)
		try {
			await fetch('/api/search/history', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: newItem.query, filters: newItem.filters }),
				credentials: 'include'
			});
		} catch (error) {
			console.error('[searchHistory][addSearch] sync failed', error);
			// This is expected for unauthenticated users, so we don't revert
		}
	};

	const deleteSearch = async (id: number) => {
		const previousState = get(store).history;

		// Optimistic update
		store.update((state) => {
			const updated = state.history.filter(item => item.id !== id);
			persist(updated);
			return { ...state, history: updated, error: null };
		});

		// Try to sync with server (will succeed for authenticated users, fail silently for unauthenticated)
		try {
			await fetch('/api/search/history', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
				credentials: 'include'
			});
		} catch (error) {
			console.error('[searchHistory][deleteSearch] sync failed', error);
			// This is expected for unauthenticated users, so we don't revert
		}
	};

	const clearAll = async () => {
		// Optimistic update
		store.update((state) => ({ ...state, history: [], error: null }));
		persist([]);

		// Try to sync with server (will succeed for authenticated users, fail silently for unauthenticated)
		try {
			await fetch('/api/search/history', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include'
			});
		} catch (error) {
			console.error('[searchHistory][clearAll] sync failed', error);
			// This is expected for unauthenticated users, so we don't revert
		}
	};

	const exportData = () => structuredClone(get(store).history);

	return {
		subscribe: store.subscribe,
		addSearch,
		deleteSearch,
		clearAll,
		exportData,
		clearError,
		setError
	};
}

export const searchHistory = createSearchHistoryStore();
