import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { MovieRecord } from '$lib/server/db';
import { resolveStreaming, getCsrfToken } from '$lib/server';
import { fetchTmdbRecommendations } from '$lib/server/services/tmdb.service';

type MovieWithDetails = MovieRecord & {
	imdbId: string | null;
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
	isAnime?: boolean;
	malId?: number | null;
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

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
	const { id: identifier } = params;

	if (!identifier) {
		return {
			mediaType: 'movie' as const,
			movie: null,
			streaming: { source: null, resolutions: [] },
			csrfToken: getCsrfToken({ cookies }) ?? undefined
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
				streaming: { source: null, resolutions: [] },
				csrfToken: getCsrfToken({ cookies }) ?? undefined
			} as const;
		}

		throw new Error(`Failed to fetch movie ${identifier}`);
	}

	const movie = (await response.json()) as MovieWithDetails | null;

	if (!movie) {
		return {
			mediaType: 'movie' as const,
			movie: null,
			streaming: { source: null, resolutions: [] },
			csrfToken: getCsrfToken({ cookies }) ?? undefined
		} as const;
	}

	if (movie.imdbId && queryMode !== 'imdb') {
		throw redirect(301, `/movie/${movie.imdbId}`);
	}

	if (!movie.imdbId && movie.tmdbId && queryMode !== 'tmdb') {
		throw redirect(301, `/movie/${movie.tmdbId}`);
	}

	const canonicalPath = movie.imdbId
		? `/movie/${movie.imdbId}`
		: `/movie/${movie.tmdbId ?? movie.id}`;

	try {
		// Detect actual media type - check if it has seasons (TV series indicator)
		const hasSeasons = (movie as any).seasons && Array.isArray((movie as any).seasons) && (movie as any).seasons.length > 0;
		const hasSeasonCount = (movie as any).seasonCount && (movie as any).seasonCount > 0;
		const actualMediaType = movie.isAnime
			? 'anime'
			: (hasSeasons || hasSeasonCount || movie.mediaType === 'tv')
				? 'tv'
				: (movie.mediaType || 'movie');

		console.log('[movie][load] Media type detection:', {
			title: movie.title,
			dbMediaType: movie.mediaType,
			hasSeasons,
			hasSeasonCount,
			actualMediaType
		});

		const streaming = await resolveStreaming({
			mediaType: actualMediaType as 'movie' | 'tv' | 'anime',
			tmdbId: Number(movie.tmdbId),
			imdbId: movie.imdbId ?? undefined,
			malId: movie.malId ?? undefined,
			subOrDub: 'sub'
		});

		let recommendations: any[] = [];
		try {
			const recommendMediaType = actualMediaType === 'anime' ? 'movie' : actualMediaType;
			recommendations = await fetchTmdbRecommendations(Number(movie.tmdbId), recommendMediaType as 'movie' | 'tv');
		} catch (recommendationError) {
			console.warn(
				'[movie][load] Failed to fetch recommendations, but continuing with streaming data',
				recommendationError
			);
		}

		return {
			mediaType: actualMediaType as 'movie' | 'tv' | 'anime',
			movie,
			streaming,
			recommendations,
			canonicalPath,
			identifier,
			queryMode,
			csrfToken: getCsrfToken({ cookies }) ?? undefined
		};
	} catch (error) {
		console.error('[movie][load] Failed to resolve streaming data', error);
		const actualMediaType = movie.isAnime ? 'anime' : (movie.mediaType || 'movie');
		return {
			mediaType: actualMediaType as 'movie' | 'tv' | 'anime',
			movie,
			streaming: { source: null, resolutions: [] },
			recommendations: [],
			canonicalPath,
			identifier,
			queryMode,
			csrfToken: getCsrfToken({ cookies }) ?? undefined
		};
	}
};
