import { sql } from 'drizzle-orm';
import { check, customType } from 'drizzle-orm/sqlite-core';
import {
	users,
	tvShows,
	seasons,
	episodes,
	people,
	watchlist,
	playbackProgress,
	searchHistory,
	collections,
	genres,
	watchlistFolders,
	watchlistTags
} from './schema';

export const urlType = customType<{ data: string; driverData: string }>({
	dataType(_config) {
		return 'text';
	},
	toDriver(value: string): string {
		try {
			new URL(value);
			return value;
		} catch {
			throw new Error('Invalid URL format');
		}
	},
	fromDriver(value: string): string {
		return value;
	}
});

export const imdbIdType = customType<{ data: string; driverData: string }>({
	dataType(_config) {
		return 'text';
	},
	toDriver(value: string): string {
		if (!/^tt\d{7,8}$/.test(value)) {
			throw new Error('Invalid IMDB ID format');
		}
		return value;
	},
	fromDriver(value: string): string {
		return value;
	}
});

export const uuidType = customType<{ data: string; driverData: string }>({
	dataType(_config) {
		return 'text';
	},
	toDriver(value: string): string {
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
			throw new Error('Invalid UUID format');
		}
		return value;
	},
	fromDriver(value: string): string {
		return value;
	}
});

export const userValidationChecks = [
	check('users_username_check', sql`length(trim(${users.username})) >= 1 AND length(trim(${users.username})) <= 39 AND ${users.username} REGEXP '^[a-zA-Z0-9-]+$'`)
];

export const tvShowValidationChecks = [
	check('tv_shows_title_check', sql`length(trim(${tvShows.title})) > 0`),
	check('tv_shows_tmdb_id_check', sql`${tvShows.tmdbId} > 0`),
	check('tv_shows_rating_check', sql`${tvShows.rating} IS NULL OR (${tvShows.rating} >= 0 AND ${tvShows.rating} <= 10)`),
	check('tv_shows_episode_runtime_check', sql`${tvShows.durationMinutes} IS NULL OR ${tvShows.durationMinutes} > 0`),
	check('tv_shows_seasons_check', sql`${tvShows.numberOfSeasons} IS NULL OR ${tvShows.numberOfSeasons} >= 0`),
	check('tv_shows_episodes_check', sql`${tvShows.numberOfEpisodes} IS NULL OR ${tvShows.numberOfEpisodes} >= 0`),
	check('tv_shows_first_air_date_check', sql`${tvShows.releaseDate} IS NULL OR ${tvShows.releaseDate} REGEXP '^\d{4}-\d{2}-\d{2}$'`),
	check('tv_shows_imdb_id_check', sql`${tvShows.imdbId} IS NULL OR ${tvShows.imdbId} REGEXP '^tt\d{7,8}$'`),
	check('tv_shows_poster_check', sql`${tvShows.posterPath} IS NULL OR ${tvShows.posterPath} LIKE 'https://%'`),
	check('tv_shows_backdrop_check', sql`${tvShows.backdropPath} IS NULL OR ${tvShows.backdropPath} LIKE 'https://%'`)
];

export const seasonValidationChecks = [
	check('seasons_name_check', sql`length(trim(${seasons.name})) > 0`),
	check('seasons_number_check', sql`${seasons.seasonNumber} >= 0`),
	check('seasons_episode_count_check', sql`${seasons.episodeCount} >= 0`),
	check('seasons_air_date_check', sql`${seasons.airDate} IS NULL OR ${seasons.airDate} REGEXP '^\d{4}-\d{2}-\d{2}$'`),
	check('seasons_poster_check', sql`${seasons.posterPath} IS NULL OR ${seasons.posterPath} LIKE 'https://%'`)
];

export const episodeValidationChecks = [
	check('episodes_name_check', sql`length(trim(${episodes.name})) > 0`),
	check('episodes_number_check', sql`${episodes.episodeNumber} > 0`),
	check('episodes_runtime_check', sql`${episodes.runtimeMinutes} IS NULL OR ${episodes.runtimeMinutes} > 0`),
	check('episodes_tmdb_id_check', sql`${episodes.tmdbId} IS NULL OR ${episodes.tmdbId} > 0`),
	check('episodes_imdb_id_check', sql`${episodes.imdbId} IS NULL OR ${episodes.imdbId} REGEXP '^tt\d{7,8}$'`),
	check('episodes_air_date_check', sql`${episodes.airDate} IS NULL OR ${episodes.airDate} REGEXP '^\d{4}-\d{2}-\d{2}$'`),
	check('episodes_still_check', sql`${episodes.stillPath} IS NULL OR ${episodes.stillPath} LIKE 'https://%'`)
];

export const personValidationChecks = [
	check('people_name_check', sql`length(trim(${people.name})) > 0`),
	check('people_tmdb_id_check', sql`${people.tmdbId} > 0`),
	check('people_popularity_check', sql`${people.popularity} IS NULL OR ${people.popularity} >= 0`),
	check('people_birthday_check', sql`${people.birthday} IS NULL OR ${people.birthday} REGEXP '^\d{4}-\d{2}-\d{2}$'`),
	check('people_deathday_check', sql`${people.deathday} IS NULL OR ${people.deathday} REGEXP '^\d{4}-\d{2}-\d{2}$'`),
	check('people_profile_check', sql`${people.profilePath} IS NULL OR ${people.profilePath} LIKE 'https://%'`)
];

export const watchlistValidationChecks = [
	check('watchlist_added_at_check', sql`${watchlist.addedAt} > 0`)
];

export const playbackProgressValidationChecks = [
	check('playback_progress_check', sql`${playbackProgress.progress} >= 0 AND ${playbackProgress.progress} <= ${playbackProgress.duration}`),
	check('playback_duration_check', sql`${playbackProgress.duration} > 0`),
	check('playback_media_type_check', sql`${playbackProgress.mediaType} IN ('movie', 'tv', 'episode')`),
	check('playback_season_episode_check', sql`(${playbackProgress.mediaType} != 'episode') OR (${playbackProgress.seasonNumber} IS NOT NULL AND ${playbackProgress.episodeNumber} IS NOT NULL)`),
	check('playback_updated_at_check', sql`${playbackProgress.updatedAt} > 0`)
];

export const searchHistoryValidationChecks = [
	check('search_history_query_check', sql`length(trim(${searchHistory.query})) > 0 AND length(trim(${searchHistory.query})) <= 200`),
	check('search_history_searched_at_check', sql`${searchHistory.searchedAt} > 0`)
];

export const collectionsValidationChecks = [
	check('collections_name_check', sql`length(trim(${collections.name})) > 0`),
	check('collections_slug_check', sql`length(trim(${collections.slug})) > 0 AND ${collections.slug} REGEXP '^[a-z0-9-]+$'`)
];

export const genresValidationChecks = [
	check('genres_name_check', sql`length(trim(${genres.name})) > 0`)
];

export const watchlistFoldersValidationChecks = [
	check('watchlist_folders_name_check', sql`length(trim(${watchlistFolders.name})) > 0`),
	check('watchlist_folders_created_at_check', sql`${watchlistFolders.createdAt} > 0`),
	check('watchlist_folders_updated_at_check', sql`${watchlistFolders.updatedAt} >= ${watchlistFolders.createdAt}`)
];

export const watchlistTagsValidationChecks = [
	check('watchlist_tags_name_check', sql`length(trim(${watchlistTags.name})) > 0`),
	check('watchlist_tags_created_at_check', sql`${watchlistTags.createdAt} > 0`)
];

function validateUrl(value: string, fieldName: string): void {
	try {
		new URL(value);
		if (!value.startsWith('https://')) {
			throw new Error(`${fieldName} must use HTTPS protocol`);
		}
	} catch {
		throw new Error(`Invalid ${fieldName} URL format`);
	}
}

function validateDate(value: string, fieldName: string): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
	}
}

function validateImdbId(value: string, fieldName: string): void {
	if (!/^tt\d{7,8}$/.test(value)) {
		throw new Error(`${fieldName} must be in format tt1234567 or tt12345678`);
	}
}

function validateTmdbId(value: number, fieldName: string): void {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${fieldName} must be a positive integer`);
	}
}

function validateRating(value: number | null | undefined, fieldName: string): void {
	if (value !== null && value !== undefined && (value < 0 || value > 10)) {
		throw new Error(`${fieldName} must be between 0 and 10`);
	}
}

function validatePositiveNumber(value: number | null | undefined, fieldName: string): void {
	if (value !== null && value !== undefined && value <= 0) {
		throw new Error(`${fieldName} must be a positive number`);
	}
}

function validateNonNegativeNumber(value: number | null | undefined, fieldName: string): void {
	if (value !== null && value !== undefined && value < 0) {
		throw new Error(`${fieldName} cannot be negative`);
	}
}

function validateRequiredString(value: string, fieldName: string): void {
	if (!value || value.trim().length === 0) {
		throw new Error(`${fieldName} is required and cannot be empty`);
	}
}

function validateMediaType(value: string | undefined, fieldName: string): void {
	if (value && !['movie', 'tv', 'anime'].includes(value)) {
		throw new Error(`${fieldName} must be one of: movie, tv, anime`);
	}
}

function validateUsername(value: string): void {
	if (!value || value.trim().length < 1 || value.trim().length > 39) {
		throw new Error('Username must be between 1 and 39 characters');
	}
	if (!/^[a-zA-Z0-9-]+$/.test(value)) {
		throw new Error('Username can only contain letters, numbers, and hyphens');
	}
}

export function validateMovieData(data: {
	tmdbId: number;
	title: string;
	overview?: string | null;
	posterPath?: string | null;
	backdropPath?: string | null;
	releaseDate?: string | null;
	rating?: number | null;
	durationMinutes?: number | null;
	is4K?: boolean;
	isHD?: boolean;
	genreNames?: string[];
	collectionId?: number | null;
	mediaType?: 'movie' | 'tv' | 'anime';
	imdbId?: string | null;
	trailerUrl?: string | null;
}): void {
	validateTmdbId(data.tmdbId, 'TMDB ID');
	validateRequiredString(data.title, 'Title');
	validateRating(data.rating, 'Rating');
	validatePositiveNumber(data.durationMinutes, 'Duration');
	validateMediaType(data.mediaType, 'Media type');

	if (data.releaseDate) validateDate(data.releaseDate, 'Release date');
	if (data.imdbId) validateImdbId(data.imdbId, 'IMDB ID');

	const urlFields = ['posterPath', 'backdropPath', 'trailerUrl'] as const;
	for (const field of urlFields) {
		const value = data[field];
		if (value) validateUrl(value, field);
	}

	if (data.genreNames) {
		for (const genre of data.genreNames) {
			validateRequiredString(genre, 'Genre name');
		}
	}
}

export function validateUserData(data: {
	username: string;
}): void {
	validateUsername(data.username);
}

export function validateTvShowData(data: {
	tmdbId: number;
	title: string;
	overview?: string | null;
	posterPath?: string | null;
	backdropPath?: string | null;
	firstAirDate?: string | null;
	rating?: number | null;
	episodeRuntime?: number | null;
	numberOfSeasons?: number | null;
	numberOfEpisodes?: number | null;
	status?: string | null;
	imdbId?: string | null;
}): void {
	validateTmdbId(data.tmdbId, 'TMDB ID');
	validateRequiredString(data.title, 'Title');
	validateRating(data.rating, 'Rating');
	validatePositiveNumber(data.episodeRuntime, 'Episode runtime');
	validateNonNegativeNumber(data.numberOfSeasons, 'Number of seasons');
	validateNonNegativeNumber(data.numberOfEpisodes, 'Number of episodes');

	if (data.firstAirDate) validateDate(data.firstAirDate, 'First air date');
	if (data.imdbId) validateImdbId(data.imdbId, 'IMDB ID');

	const urlFields = ['posterPath', 'backdropPath'] as const;
	for (const field of urlFields) {
		const value = data[field];
		if (value) validateUrl(value, field);
	}
}

export function validateEpisodeData(data: {
	name: string;
	episodeNumber: number;
	runtimeMinutes?: number | null;
	tmdbId?: number | null;
	imdbId?: string | null;
	airDate?: string | null;
	stillPath?: string | null;
}): void {
	validateRequiredString(data.name, 'Episode name');

	if (!Number.isInteger(data.episodeNumber) || data.episodeNumber <= 0) {
		throw new Error('Episode number must be a positive integer');
	}

	validatePositiveNumber(data.runtimeMinutes, 'Runtime');

	if (data.tmdbId !== null && data.tmdbId !== undefined) {
		validateTmdbId(data.tmdbId, 'TMDB ID');
	}

	if (data.imdbId) validateImdbId(data.imdbId, 'IMDB ID');
	if (data.airDate) validateDate(data.airDate, 'Air date');
	if (data.stillPath) validateUrl(data.stillPath, 'Still path');
}

export function validatePersonData(data: {
	tmdbId: number;
	name: string;
	biography?: string | null;
	birthday?: string | null;
	deathday?: string | null;
	placeOfBirth?: string | null;
	profilePath?: string | null;
	popularity?: number | null;
}): void {
	validateTmdbId(data.tmdbId, 'TMDB ID');
	validateRequiredString(data.name, 'Name');
	validateNonNegativeNumber(data.popularity, 'Popularity');

	if (data.birthday) validateDate(data.birthday, 'Birthday');
	if (data.deathday) validateDate(data.deathday, 'Deathday');
	if (data.profilePath) validateUrl(data.profilePath, 'Profile path');
}
