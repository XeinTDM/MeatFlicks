import { db } from '$lib/server/db';
import { genres, tvShows as tvShowsSchema, tvShowsGenres } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { GenreRecord, MovieRecord, MovieRow } from '$lib/server/db';
import { mapRowsToRecords } from '$lib/server/db/movie-select';
import { personRepository } from '$lib/server/repositories/person.repository';
import { syncMovieCast, syncMovieCrew } from '$lib/server/services/person-sync.service';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import {
	fetchTmdbMovieDetails,
	type TmdbMovieDetails,
	fetchTmdbTvDetails,
	type TmdbTvDetails
} from '$lib/server/services/tmdb.service';
import { ofetch } from 'ofetch';
import { env } from '$lib/config/env';
import type { InferSelectModel } from 'drizzle-orm';
import { bulkUpsertMovies, type UpsertMoviePayload } from '$lib/server/db/mutations';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const api = ofetch.create({
	baseURL: TMDB_BASE_URL,
	params: {
		api_key: env.TMDB_API_KEY
	},
	retry: 3,
	retryDelay: 1000
});

const fetchTmdbListIds = async (
	path: string,
	params: Record<string, any>,
	limit: number,
	rateLimitKey: string
): Promise<number[]> => {
	const TMDB_PAGE_SIZE = 20;
	const totalPages = Math.ceil(limit / TMDB_PAGE_SIZE);
	const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

	const responses = await Promise.all(
		pages.map((page) =>
			tmdbRateLimiter.schedule(rateLimitKey, () =>
				api(path, {
					query: {
						language: 'en-US',
						include_adult: 'false',
						page,
						...params
					}
				})
			)
		)
	);

	const ids: number[] = [];
	for (const payload of responses) {
		const results = (payload as any).results;
		if (!Array.isArray(results)) continue;

		for (const entry of results) {
			const id = entry.id;
			if (id) ids.push(id);
			if (ids.length >= limit) break;
		}

		if (ids.length >= limit) break;
	}

	return ids;
};

export const fetchTopRatedMovieIds = async (limit = 250): Promise<number[]> => {
	console.log(`Fetching top ${limit} rated movie IDs from TMDB...`);
	try {
		const ids = await fetchTmdbListIds('/movie/top_rated', {}, limit, 'tmdb-top-rated-movies');
		console.log(`Fetched ${ids.length} top-rated movie IDs.`);
		return ids;
	} catch (error) {
		console.error('Error fetching top-rated movie IDs from TMDB:', error);
		throw error;
	}
};

const fetchMovieDetailsForIds = async (tmdbIds: number[]): Promise<(TmdbMovieDetails | null)[]> => {
	console.log(`Fetching details for ${tmdbIds.length} movie IDs...`);
	const details: (TmdbMovieDetails | null)[] = [];
	const batchSize = 50;

	for (let i = 0; i < tmdbIds.length; i += batchSize) {
		const batch = tmdbIds.slice(i, i + batchSize);
		const batchPromises = batch.map(async (tmdbId) => {
			try {
				const movieDetail = await fetchTmdbMovieDetails(tmdbId);
				if (movieDetail.found) {
					return movieDetail;
				}
				return null;
			} catch (error) {
				console.error(`Error fetching details for TMDB ID ${tmdbId}:`, error);
				return null;
			}
		});

		const batchResults = await Promise.all(batchPromises);
		details.push(...batchResults.filter((d): d is TmdbMovieDetails => d !== null));
		console.log(`Processed batch ${i / batchSize + 1}. Total details fetched: ${details.length}`);
	}
	console.log(`Finished fetching details for ${details.length} movies.`);
	return details;
};

const prepareMoviePayloads = async (
	movieDetails: TmdbMovieDetails[]
): Promise<UpsertMoviePayload[]> => {
	console.log(`Preparing ${movieDetails.length} movie payloads...`);
	const payloads: UpsertMoviePayload[] = [];

	for (const detail of movieDetails) {
		if (!detail) continue;

		payloads.push({
			tmdbId: detail.tmdbId,
			title: detail.title || 'Untitled Movie',
			overview: detail.overview,
			posterPath: detail.posterPath,
			backdropPath: detail.backdropPath,
			releaseDate: detail.releaseDate,
			rating: detail.rating,
			durationMinutes: detail.runtime,
			is4K: false,
			isHD: true,
			genreNames: detail.genres.map((g) => g.name),
			mediaType: 'movie',
			imdbId: detail.imdbId,
			trailerUrl: detail.trailerUrl
		});
	}
	console.log(`Prepared ${payloads.length} movie payloads.`);
	return payloads;
};

export const importTopRatedMovies = async () => {
	console.log('Starting import of top-rated movies...');
	try {
		const movieIds = await fetchTopRatedMovieIds(250);
		if (movieIds.length === 0) {
			console.warn('No movie IDs fetched from TMDB. Aborting import.');
			return;
		}

		const movieDetails = await fetchMovieDetailsForIds(movieIds);
		const validMovieDetails = movieDetails.filter((d): d is TmdbMovieDetails => d !== null);

		if (validMovieDetails.length === 0) {
			console.warn('No valid movie details fetched. Aborting import.');
			return;
		}

		const payloads = await prepareMoviePayloads(validMovieDetails);
		if (payloads.length === 0) {
			console.warn('No movie payloads prepared. Aborting import.');
			return;
		}

		const importedMovies = await bulkUpsertMovies(payloads);
		console.log(`Successfully imported/upserted ${importedMovies.length} movies.`);
	} catch (error) {
		console.error('Error during top-rated movies import:', error);
	}
};

export const fetchTopRatedTvShowIds = async (limit = 250): Promise<number[]> => {
	console.log(`Fetching top ${limit} rated TV show IDs from TMDB...`);
	try {
		const ids = await fetchTmdbListIds('/tv/top_rated', {}, limit, 'tmdb-top-rated-tv');
		console.log(`Fetched ${ids.length} top-rated TV show IDs.`);
		return ids;
	} catch (error) {
		console.error('Error fetching top-rated TV show IDs from TMDB:', error);
		throw error;
	}
};

const fetchTvShowDetailsForIds = async (tmdbIds: number[]): Promise<(TmdbTvDetails | null)[]> => {
	console.log(`Fetching details for ${tmdbIds.length} TV show IDs...`);
	const details: (TmdbTvDetails | null)[] = [];
	const batchSize = 50;

	for (let i = 0; i < tmdbIds.length; i += batchSize) {
		const batch = tmdbIds.slice(i, i + batchSize);
		const batchPromises = batch.map(async (tmdbId) => {
			try {
				const tvShowDetail = await fetchTmdbTvDetails(tmdbId);
				if (tvShowDetail.found) {
					return tvShowDetail;
				}
				return null;
			} catch (error) {
				console.error(`Error fetching details for TMDB ID ${tmdbId}:`, error);
				return null;
			}
		});

		const batchResults = await Promise.all(batchPromises);
		details.push(...batchResults.filter((d): d is TmdbTvDetails => d !== null));
		console.log(`Processed batch ${i / batchSize + 1}. Total details fetched: ${details.length}`);
	}
	console.log(`Finished fetching details for ${details.length} TV shows.`);
	return details;
};

export type UpsertTvShowPayload = {
	tmdbId: number;
	title: string;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	firstAirDate: string | null;
	rating: number | null;
	episodeRuntime: number | null;
	numberOfSeasons: number | null;
	numberOfEpisodes: number | null;
	status: string | null;
	genreNames: string[];
	imdbId: string | null;
	trailerUrl: string | null;
	productionCompanies: string | null;
	streamingProviders: string | null;
};

const prepareTvShowPayloads = async (
	tvShowDetails: TmdbTvDetails[]
): Promise<UpsertTvShowPayload[]> => {
	console.log(`Preparing ${tvShowDetails.length} TV show payloads...`);
	const payloads: UpsertTvShowPayload[] = [];

	for (const detail of tvShowDetails) {
		if (!detail) continue;

		payloads.push({
			tmdbId: detail.tmdbId,
			title: detail.name || 'Untitled TV Show',
			overview: detail.overview,
			posterPath: detail.posterPath,
			backdropPath: detail.backdropPath,
			firstAirDate: detail.firstAirDate,
			rating: detail.rating,
			episodeRuntime: detail.episodeRuntimes?.[0] || null,
			numberOfSeasons: detail.seasonCount,
			numberOfEpisodes: detail.episodeCount,
			status: null,
			genreNames: detail.genres.map((g) => g.name),
			imdbId: detail.imdbId,
			trailerUrl: detail.trailerUrl,
			productionCompanies: detail.productionCompanies
				? JSON.stringify(
						detail.productionCompanies.map((c) => ({ name: c.name, logoPath: c.logoPath }))
					)
				: null,
			streamingProviders: null
		});
	}
	console.log(`Prepared ${payloads.length} TV show payloads.`);
	return payloads;
};

export const bulkUpsertTvShows = async (
	payloads: UpsertTvShowPayload[]
): Promise<InferSelectModel<typeof tvShowsSchema>[]> => {
	if (payloads.length === 0) return [];

	return await db.transaction(async (tx) => {
		const results: InferSelectModel<typeof tvShowsSchema>[] = [];

		for (const payload of payloads) {
			const genreIds: number[] = [];
			for (const rawName of payload.genreNames) {
				const name = rawName.trim();
				if (!name) continue;

				const existing = await tx.select().from(genres).where(eq(genres.name, name)).limit(1);
				if (existing.length > 0) {
					genreIds.push(existing[0].id);
					continue;
				}

				const result = await tx.insert(genres).values({ name }).returning({ id: genres.id });
				genreIds.push(result[0].id);
			}

			const existingTvShows = await tx
				.select()
				.from(tvShowsSchema)
				.where(eq(tvShowsSchema.tmdbId, payload.tmdbId))
				.limit(1);
			const existingTvShow = existingTvShows[0];

			let insertedOrUpdatedTvShow: InferSelectModel<typeof tvShowsSchema> | undefined;

			if (existingTvShow) {
				const tvShowData = {
					tmdbId: payload.tmdbId,
					title: payload.title,
					overview: payload.overview,
					posterPath: payload.posterPath,
					backdropPath: payload.backdropPath,
					releaseDate: payload.firstAirDate,
					rating: payload.rating,
					durationMinutes: payload.episodeRuntime,
					numberOfSeasons: payload.numberOfSeasons,
					numberOfEpisodes: payload.numberOfEpisodes,
					status: payload.status || 'not_found',
					productionCompanies: payload.productionCompanies,
					streamingProviders: payload.streamingProviders,
					imdbId: payload.imdbId,
					mediaType: 'tv',
					updatedAt: Date.now()
				};
				await tx
					.update(tvShowsSchema)
					.set(tvShowData)
					.where(eq(tvShowsSchema.tmdbId, payload.tmdbId));
				insertedOrUpdatedTvShow = {
					...existingTvShow,
					...tvShowData,
					createdAt: existingTvShow.createdAt
				} as any;
			} else {
				const tvShowData = {
					tmdbId: payload.tmdbId,
					title: payload.title,
					overview: payload.overview,
					posterPath: payload.posterPath,
					backdropPath: payload.backdropPath,
					releaseDate: payload.firstAirDate,
					rating: payload.rating,
					durationMinutes: payload.episodeRuntime,
					numberOfSeasons: payload.numberOfSeasons,
					numberOfEpisodes: payload.numberOfEpisodes,
					status: payload.status || 'not_found',
					productionCompanies: payload.productionCompanies,
					streamingProviders: payload.streamingProviders,
					imdbId: payload.imdbId,
					mediaType: 'tv',
					createdAt: Date.now(),
					updatedAt: Date.now()
				};
				const result = await tx.insert(tvShowsSchema).values(tvShowData).returning();
				insertedOrUpdatedTvShow = result[0] as any;
			}

			if (!insertedOrUpdatedTvShow) {
				console.error(`Failed to insert/update TV show with TMDB ID ${payload.tmdbId}`);
				continue;
			}
			results.push(insertedOrUpdatedTvShow);

			for (const genreId of genreIds) {
				await tx
					.insert(tvShowsGenres)
					.values({
						mediaId: insertedOrUpdatedTvShow.id,
						genreId
					})
					.onConflictDoNothing();
			}
		}
		return results;
	});
};

export const importTopRatedTvShows = async () => {
	console.log('Starting import of top-rated TV shows...');
	try {
		const tvShowIds = await fetchTopRatedTvShowIds(250);
		if (tvShowIds.length === 0) {
			console.warn('No TV show IDs fetched from TMDB. Aborting import.');
			return;
		}

		const tvShowDetails = await fetchTvShowDetailsForIds(tvShowIds);
		const validTvShowDetails = tvShowDetails.filter((d): d is TmdbTvDetails => d !== null);

		if (validTvShowDetails.length === 0) {
			console.warn('No valid TV show details fetched. Aborting import.');
			return;
		}

		const payloads = await prepareTvShowPayloads(validTvShowDetails);
		if (payloads.length === 0) {
			console.warn('No TV show payloads prepared. Aborting import.');
			return;
		}

		const importedTvShows = await bulkUpsertTvShows(payloads);
		console.log(`Successfully imported/upserted ${importedTvShows.length} TV shows.`);
	} catch (error) {
		console.error('Error during top-rated TV shows import:', error);
	}
};

export const importPopularMovies = async (limit = 250) => {
	console.log(`Starting import of ${limit} popular movies...`);
	try {
		const ids = await fetchTmdbListIds('/movie/popular', {}, limit, 'tmdb-popular-movies');
		if (ids.length === 0) {
			console.warn('No movie IDs fetched from TMDB. Aborting import.');
			return;
		}

		const movieDetails = await fetchMovieDetailsForIds(ids);
		const validMovieDetails = movieDetails.filter((d): d is TmdbMovieDetails => d !== null);

		if (validMovieDetails.length === 0) {
			console.warn('No valid movie details fetched. Aborting import.');
			return;
		}

		const payloads = await prepareMoviePayloads(validMovieDetails);
		if (payloads.length === 0) {
			console.warn('No movie payloads prepared. Aborting import.');
			return;
		}

		const importedMovies = await bulkUpsertMovies(payloads);
		console.log(`Successfully imported/upserted ${importedMovies.length} popular movies.`);
	} catch (error) {
		console.error('Error during popular movies import:', error);
	}
};

export const importPopularTvShows = async (limit = 250) => {
	console.log(`Starting import of ${limit} popular TV shows...`);
	try {
		const ids = await fetchTmdbListIds('/tv/popular', {}, limit, 'tmdb-popular-tv');
		if (ids.length === 0) {
			console.warn('No TV show IDs fetched from TMDB. Aborting import.');
			return;
		}

		const tvShowDetails = await fetchTvShowDetailsForIds(ids);
		const validTvShowDetails = tvShowDetails.filter((d): d is TmdbTvDetails => d !== null);

		if (validTvShowDetails.length === 0) {
			console.warn('No valid TV show details fetched. Aborting import.');
			return;
		}

		const payloads = await prepareTvShowPayloads(validTvShowDetails);
		if (payloads.length === 0) {
			console.warn('No TV show payloads prepared. Aborting import.');
			return;
		}

		const importedTvShows = await bulkUpsertTvShows(payloads);
		console.log(`Successfully imported/upserted ${importedTvShows.length} popular TV shows.`);
	} catch (error) {
		console.error('Error during popular TV shows import:', error);
	}
};

export const importFromTmdbIds = async (tmdbIds: number[], mediaType: 'movie' | 'tv' = 'movie') => {
	console.log(`Starting import of ${tmdbIds.length} ${mediaType}s from provided TMDB IDs...`);
	try {
		if (mediaType === 'movie') {
			const movieDetails = await fetchMovieDetailsForIds(tmdbIds);
			const validMovieDetails = movieDetails.filter((d): d is TmdbMovieDetails => d !== null);

			if (validMovieDetails.length === 0) {
				console.warn('No valid movie details fetched. Aborting import.');
				return;
			}

			const payloads = await prepareMoviePayloads(validMovieDetails);
			if (payloads.length === 0) {
				console.warn('No movie payloads prepared. Aborting import.');
				return;
			}

			const importedMovies = await bulkUpsertMovies(payloads);
			console.log(
				`Successfully imported/upserted ${importedMovies.length} movies from provided IDs.`
			);
		} else {
			const tvShowDetails = await fetchTvShowDetailsForIds(tmdbIds);
			const validTvShowDetails = tvShowDetails.filter((d): d is TmdbTvDetails => d !== null);

			if (validTvShowDetails.length === 0) {
				console.warn('No valid TV show details fetched. Aborting import.');
				return;
			}

			const payloads = await prepareTvShowPayloads(validTvShowDetails);
			if (payloads.length === 0) {
				console.warn('No TV show payloads prepared. Aborting import.');
				return;
			}

			const importedTvShows = await bulkUpsertTvShows(payloads);
			console.log(
				`Successfully imported/upserted ${importedTvShows.length} TV shows from provided IDs.`
			);
		}
	} catch (error) {
		console.error(`Error during import from TMDB IDs for ${mediaType}:`, error);
	}
};
