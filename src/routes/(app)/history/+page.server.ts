import type { PageServerLoad } from './$types';
import { libraryRepository } from '$lib/server';
import { fromSlug } from '$lib/utils';

const HISTORY_SLUG = 'history';

export const load: PageServerLoad = async () => {
	const collection = await libraryRepository.findCollectionWithMovies(HISTORY_SLUG);

	if (!collection) {
		return {
			collectionTitle: fromSlug(HISTORY_SLUG),
			movies: [],
			hasContent: false
		};
	}

	const { name: collectionTitle, movies } = collection;

	return {
		collectionTitle,
		movies,
		hasContent: movies.length > 0
	};
};
