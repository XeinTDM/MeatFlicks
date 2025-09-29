import type { PageServerLoad } from './$types';
import { libraryService } from '$lib/server';

export const load: PageServerLoad = async () => {
	const homeLibraryPromise = libraryService.fetchHomeLibrary();

	return {
		streamed: {
			homeLibrary: homeLibraryPromise
		}
	};
};
