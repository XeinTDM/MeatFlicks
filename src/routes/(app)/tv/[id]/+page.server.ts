import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveStreaming } from '$lib/server';

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

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { id: identifier } = params;

	if (!identifier) {
		return {
			mediaType: 'tv' as const,
			movie: null,
			streaming: { source: null, resolutions: [] }
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
				streaming: { source: null, resolutions: [] }
			};
		}

		throw new Error(`Failed to fetch TV show ${identifier}`);
	}

	const tvShow = (await response.json()) as TvWithDetails | null;

	if (!tvShow) {
		return {
			mediaType: 'tv' as const,
			movie: null,
			streaming: { source: null, resolutions: [] }
		};
	}

	const canonicalPath = tvShow.imdbId
		? `/tv/${tvShow.imdbId}`
		: `/tv/${tvShow.tmdbId ?? tvShow.id}`;

	if (tvShow.imdbId && queryMode !== 'imdb') {
		throw redirect(301, canonicalPath);
	}

	try {
		const streaming = await resolveStreaming({
			mediaType: 'tv',
			tmdbId: Number(tvShow.tmdbId),
			imdbId: tvShow.imdbId ?? undefined
		});

		return {
			mediaType: 'tv' as const,
			movie: tvShow,
			streaming,
			canonicalPath,
			identifier,
			queryMode
		};
	} catch (error) {
		console.error('[tv][load] Failed to resolve streaming sources', error);
		return {
			mediaType: 'tv' as const,
			movie: tvShow,
			streaming: { source: null, resolutions: [] },
			canonicalPath,
			identifier,
			queryMode
		};
	}
};
