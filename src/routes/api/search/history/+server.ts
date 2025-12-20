import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchHistoryRepository } from '$lib/server/repositories/search-history.repository';
import type { MovieFilters } from '$lib/types/filters';

export const GET: RequestHandler = async ({ locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const limit = 10;
		const searches = await searchHistoryRepository.getRecentSearches(user.id, limit);
		return json({ searches });
	} catch (error) {
		console.error('Error fetching search history:', error);
		return json({ error: 'Failed to fetch search history' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { query, filters } = body;

		if (!query || typeof query !== 'string' || !query.trim()) {
			return json({ error: 'Query is required' }, { status: 400 });
		}

		if (filters && typeof filters !== 'object') {
			return json({ error: 'Invalid filters format' }, { status: 400 });
		}

		await searchHistoryRepository.addSearch(
			user.id,
			query.trim(),
			filters as MovieFilters | undefined
		);
		return json({ success: true });
	} catch (error) {
		console.error('Error adding search to history:', error);
		return json({ error: 'Failed to save search history' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { id } = body;

		if (id !== undefined) {
			if (typeof id !== 'number') {
				return json({ error: 'Invalid search ID' }, { status: 400 });
			}
			await searchHistoryRepository.deleteSearch(user.id, id);
		} else {
			await searchHistoryRepository.clearHistory(user.id);
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting search history:', error);
		return json({ error: 'Failed to delete search history' }, { status: 500 });
	}
};
