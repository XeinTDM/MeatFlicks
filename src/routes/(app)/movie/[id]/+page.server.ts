import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { MovieRecord } from '$lib/server/db';
import { resolveStreaming } from '$lib/server';
import { fetchTmdbRecommendations } from '$lib/server/services/tmdb.service';

type MovieWithDetails = MovieRecord & {
	imdbId: string | null;
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
};

const detectQueryMode = (identifier: string): 'id' | 'tmdb' | 'imdb' => {
	if (/^tt\d{7,}$/i.test(identifier)) {
		return 'imdb';
	}

	if (/^\d+$/.test(identifier)) {
		return 'tmdb';
	}

	return 'id';
};

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { id: identifier } = params;

	if (!identifier) {
		return {
			mediaType: 'movie' as const,
			movie: null,
			streaming: { source: null, resolutions: [] }
		} as const;
	}

	const queryMode = detectQueryMode(identifier);
	const apiPath = `/api/movies/${identifier}${queryMode === 'id' ? '' : `?by=${queryMode}`}`;
	const response = await fetch(apiPath);

	if (!response.ok) {
		if (response.status === 404) {
			return {
				mediaType: 'movie' as const,
				movie: null,
				streaming: { source: null, resolutions: [] }
			} as const;
		}

		throw new Error(`Failed to fetch movie ${identifier}`);
	}

	const movie = (await response.json()) as MovieWithDetails | null;

	if (!movie) {
		return {
			mediaType: 'movie' as const,
			movie: null,
			streaming: { source: null, resolutions: [] }
		} as const;
	}

	if (movie.imdbId && queryMode !== 'imdb') {
		throw redirect(301, `/movie/${movie.imdbId}`);
	}

	const canonicalPath = movie.imdbId
		? `/movie/${movie.imdbId}`
		: `/movie/${movie.tmdbId ?? movie.id}`;

	try {
		const [streaming, recommendations] = await Promise.all([
			resolveStreaming({
				mediaType: 'movie',
				tmdbId: Number(movie.tmdbId),
				imdbId: movie.imdbId ?? undefined
			}),
			fetchTmdbRecommendations(Number(movie.tmdbId), 'movie')
		]);

		return {
			mediaType: 'movie' as const,
			movie,
			streaming,
			recommendations,
			canonicalPath,
			identifier,
			queryMode
		};
	} catch (error) {
		console.error('[movie][load] Failed to resolve data', error);
		return {
			mediaType: 'movie' as const,
			movie,
			streaming: { source: null, resolutions: [] },
			recommendations: [],
			canonicalPath,
			identifier,
			queryMode
		};
	}
};
