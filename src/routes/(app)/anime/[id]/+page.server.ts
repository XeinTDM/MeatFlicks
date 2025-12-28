import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveStreaming, getCsrfToken } from '$lib/server';
import { fetchTmdbRecommendations } from '$lib/server/services/tmdb.service';

type AnimeWithDetails = {
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
    malId?: number | null;
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
            mediaType: 'anime' as const,
            movie: null,
            streaming: { source: null, resolutions: [] },
            csrfToken: getCsrfToken({ cookies }) ?? undefined
        };
    }

    const queryMode = detectQueryMode(identifier);
    const apiPath = `/api/anime/${identifier}${queryMode === 'tmdb' ? '' : `?by=${queryMode}`}`;
    const response = await fetch(apiPath);

    if (!response.ok) {
        if (response.status === 404) {
            return {
                mediaType: 'anime' as const,
                movie: null,
                streaming: { source: null, resolutions: [] },
                csrfToken: getCsrfToken({ cookies }) ?? undefined
            };
        }

        throw new Error(`Failed to fetch anime ${identifier}`);
    }

    const anime = (await response.json()) as AnimeWithDetails | null;

    if (!anime) {
        return {
            mediaType: 'anime' as const,
            movie: null,
            streaming: { source: null, resolutions: [] },
            csrfToken: getCsrfToken({ cookies }) ?? undefined
        };
    }

    const canonicalPath = anime.imdbId
        ? `/anime/${anime.imdbId}`
        : `/anime/${anime.tmdbId ?? anime.id}`;

    if (anime.imdbId && queryMode !== 'imdb') {
        throw redirect(301, canonicalPath);
    }

    try {
        const streaming = await resolveStreaming({
            mediaType: 'anime',
            tmdbId: Number(anime.tmdbId),
            imdbId: anime.imdbId ?? undefined,
            malId: anime.malId ?? undefined,
            subOrDub: 'sub'
        });

        let recommendations: any[] = [];
        try {
            const recType = anime.seasons && anime.seasons.length > 0 ? 'tv' : 'movie';
            recommendations = await fetchTmdbRecommendations(Number(anime.tmdbId), recType);
        } catch (recommendationError) {
            console.warn('[anime][load] Failed to fetch recommendations', recommendationError);
        }

        return {
            mediaType: 'anime' as const,
            movie: anime,
            streaming,
            recommendations,
            canonicalPath,
            identifier,
            queryMode,
            csrfToken: getCsrfToken({ cookies }) ?? undefined
        };
    } catch (error) {
        console.error('[anime][load] Failed to resolve streaming data', error);
        return {
            mediaType: 'anime' as const,
            movie: anime,
            streaming: { source: null, resolutions: [] },
            recommendations: [],
            canonicalPath,
            identifier,
            queryMode,
            csrfToken: getCsrfToken({ cookies }) ?? undefined
        };
    }
};
