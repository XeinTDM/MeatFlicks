import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Prisma } from '@prisma/client';
import { resolveStreaming } from '$lib/server';

type MovieWithDetails = Prisma.MovieGetPayload<{
	include: {
		genres: true;
	};
}> & {
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
			movie: null,
			streaming: { source: null, resolutions: [] }
		} as const;
	}

	const queryMode = detectQueryMode(identifier);
	const apiPath = `/api/movies/${identifier}${queryMode === 'id' ? '' : `?by=${queryMode}`}`;
	const response = await fetch(apiPath);

	if (!response.ok) {
		if (response.status === 404) {
			return { movie: null, streaming: { source: null, resolutions: [] } } as const;
		}

		throw new Error(`Failed to fetch movie ${identifier}`);
	}

	const movie = (await response.json()) as MovieWithDetails | null;

	if (!movie) {
		return { movie: null, streaming: { source: null, resolutions: [] } } as const;
	}

	if (movie.imdbId && queryMode !== 'imdb') {
		throw redirect(301, `/movie/${movie.imdbId}`);
	}

	const canonicalPath = movie.imdbId
		? `/movie/${movie.imdbId}`
		: `/movie/${movie.tmdbId ?? movie.id}`;

	try {
		const streaming = await resolveStreaming({
			mediaType: 'movie',
			tmdbId: Number(movie.tmdbId),
			imdbId: movie.imdbId ?? undefined
		});

		return {
			movie,
			streaming,
			canonicalPath,
			identifier,
			queryMode
		} as const;
	} catch (error) {
		console.error('[movie][load] Failed to resolve streaming sources', error);
		return {
			movie,
			streaming: { source: null, resolutions: [] },
			canonicalPath,
			identifier,
			queryMode
		} as const;
	}
};
