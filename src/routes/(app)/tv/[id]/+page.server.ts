import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveStreaming, getCsrfToken } from '$lib/server';
import { fetchTmdbRecommendations } from '$lib/server/services/tmdb.service';

type TvWithDetails = {
	id: string;
	tmdbId: number | null;
	title: string;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	releaseDate: string | null;
	rating: number | null;
	durationMinutes: number | null;
	genres?: { id: number; name: string }[];
	cast?: { id: number; name: string; character: string }[];
	trailerUrl?: string | null;
	imdbId?: string | null;
	seasonCount?: number | null;
	episodeCount?: number | null;
	seasons?: {
		id: number;
		name: string;
		seasonNumber: number;
		episodeCount: number;
		posterPath: string | null;
	}[];
};

const detectQueryMode = (identifier: string): 'tmdb' | 'imdb' => {
	if (/^tt\d{7,}$/i.test(identifier)) {
		return 'imdb';
	}

	if (/^\d+$/.test(identifier)) {
		return 'tmdb';
	}

	return 'tmdb';
};

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
	const { id: identifier } = params;

	if (!identifier) {
		return {
			mediaType: 'tv' as const,
			movie: null,
			streaming: { source: null, resolutions: [] },
			csrfToken: getCsrfToken({ cookies }) ?? undefined
		};
	}

	const queryMode = detectQueryMode(identifier);
	const apiPath = `/api/tv/${identifier}${queryMode === 'tmdb' ? '' : `?by=${queryMode}`}`;
	const response = await fetch(apiPath);

	if (!response.ok) {
		if (response.status === 404) {
			return {
				mediaType: 'tv' as const,
				movie: null,
				streaming: { source: null, resolutions: [] },
				csrfToken: getCsrfToken({ cookies }) ?? undefined
			};
		}

		throw new Error(`Failed to fetch TV show ${identifier}`);
	}

	const tvShow = (await response.json()) as TvWithDetails | null;

	if (!tvShow) {
		return {
			mediaType: 'tv' as const,
			movie: null,
			streaming: { source: null, resolutions: [] },
			csrfToken: getCsrfToken({ cookies }) ?? undefined
		};
	}

	const canonicalPath = tvShow.imdbId
		? `/tv/${tvShow.imdbId}`
		: `/tv/${tvShow.tmdbId ?? tvShow.id}`;

	if (tvShow.imdbId && queryMode !== 'imdb') {
		throw redirect(301, canonicalPath);
	}

	try {
		// Try to resolve streaming first - this is critical
		const streaming = await resolveStreaming({
			mediaType: 'tv',
			tmdbId: Number(tvShow.tmdbId),
			imdbId: tvShow.imdbId ?? undefined
		});

		// Try to get recommendations, but don't fail if this doesn't work
		let recommendations: any[] = [];
		try {
			recommendations = await fetchTmdbRecommendations(Number(tvShow.tmdbId), 'tv');
		} catch (recommendationError) {
			console.warn('[tv][load] Failed to fetch recommendations, but continuing with streaming data', recommendationError);
			// Continue with empty recommendations rather than failing the whole request
		}

		return {
			mediaType: 'tv' as const,
			movie: tvShow,
			streaming,
			recommendations,
			canonicalPath,
			identifier,
			queryMode,
			csrfToken: getCsrfToken({ cookies }) ?? undefined
		};
	} catch (error) {
		console.error('[tv][load] Failed to resolve streaming data', error);
		return {
			mediaType: 'tv' as const,
			movie: tvShow,
			streaming: { source: null, resolutions: [] },
			recommendations: [],
			canonicalPath,
			identifier,
			queryMode,
			csrfToken: getCsrfToken({ cookies }) ?? undefined
		};
	}
};
