import {
	sqliteTable,
	text,
	integer,
	real,
	primaryKey,
	index,
	customType
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const schemaInfo = sqliteTable('schema_info', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const collections = sqliteTable('collections', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	slug: text('slug').notNull().unique(),
	description: text('description')
});

export const movies = sqliteTable(
	'movies',
	{
		numericId: integer('numericId').primaryKey({ autoIncrement: true }),
		id: text('id').notNull().unique(),
		tmdbId: integer('tmdbId').notNull().unique(),
		title: text('title').notNull(),
		overview: text('overview'),
		posterPath: text('posterPath'),
		backdropPath: text('backdropPath'),
		releaseDate: text('releaseDate'),
		rating: real('rating'),
		durationMinutes: integer('durationMinutes'),
		is4K: integer('is4K').notNull().default(0),
		isHD: integer('isHD').notNull().default(0),
		language: text('language'),
		popularity: real('popularity'),
		collectionId: integer('collectionId').references(() => collections.id, {
			onDelete: 'set null'
		}),
		createdAt: integer('createdAt')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updatedAt')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		index('idx_movies_tmdbId').on(table.tmdbId),
		index('idx_movies_collectionId').on(table.collectionId),
		index('idx_movies_rating').on(table.rating),
		index('idx_movies_language').on(table.language),
		index('idx_movies_popularity').on(table.popularity),
		index('idx_movies_releaseDate').on(table.releaseDate),
		index('idx_movies_durationMinutes').on(table.durationMinutes)
	]
);

export const genres = sqliteTable('genres', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique()
});

export const moviesGenres = sqliteTable(
	'movies_genres',
	{
		movieId: text('movieId')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		genreId: integer('genreId')
			.notNull()
			.references(() => genres.id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.movieId, table.genreId] }),
		index('idx_movies_genres_movie').on(table.movieId),
		index('idx_movies_genres_genre').on(table.genreId)
	]
);

export const cache = sqliteTable(
	'cache',
	{
		key: text('key').primaryKey(),
		data: text('data').notNull(),
		expiresAt: integer('expiresAt').notNull()
	},
	(table) => [index('idx_cache_expiresAt').on(table.expiresAt)]
);

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	expiresAt: integer('expires_at').notNull()
});

export const watchlist = sqliteTable(
	'watchlist',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		movieId: text('movie_id').notNull(),
		movieData: text('movie_data').notNull(),
		addedAt: integer('added_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.movieId] }),
		index('idx_watchlist_user').on(table.userId),
		index('idx_watchlist_addedAt').on(table.addedAt)
	]
);

export const watchHistory = sqliteTable(
	'watch_history',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		movieId: text('movie_id').notNull(),
		movieData: text('movie_data').notNull(), // JSON string of history entry
		watchedAt: integer('watched_at').notNull()
	},
	(table) => [
		index('idx_history_user').on(table.userId),
		index('idx_history_watchedAt').on(table.watchedAt)
	]
);

export const searchHistory = sqliteTable(
	'search_history',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		query: text('query').notNull(),
		filters: text('filters'), // JSON string of applied filters
		searchedAt: integer('searched_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		index('idx_search_history_user').on(table.userId),
		index('idx_search_history_searched_at').on(table.searchedAt)
	]
);

export const playbackProgress = sqliteTable(
	'playback_progress',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		mediaId: text('media_id').notNull(),
		mediaType: text('media_type').notNull(), // 'movie' | 'tv'
		progress: integer('progress').notNull(), // seconds
		duration: integer('duration').notNull(), // total seconds
		seasonNumber: integer('season_number'),
		episodeNumber: integer('episode_number'),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		index('idx_playback_progress_user').on(table.userId),
		index('idx_playback_progress_media').on(table.mediaId),
		index('idx_playback_progress_updated').on(table.updatedAt)
	]
);

export const people = sqliteTable(
	'people',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tmdbId: integer('tmdbId').notNull().unique(),
		name: text('name').notNull(),
		biography: text('biography'),
		birthday: text('birthday'), // ISO date string
		deathday: text('deathday'), // ISO date string
		placeOfBirth: text('placeOfBirth'),
		profilePath: text('profilePath'),
		popularity: real('popularity'),
		knownForDepartment: text('knownForDepartment'), // 'Acting', 'Directing', etc.
		createdAt: integer('createdAt')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updatedAt')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		index('idx_people_tmdbId').on(table.tmdbId),
		index('idx_people_name').on(table.name),
		index('idx_people_popularity').on(table.popularity),
		index('idx_people_knownForDepartment').on(table.knownForDepartment)
	]
);

export const moviePeople = sqliteTable(
	'movie_people',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		movieId: text('movieId')
			.notNull()
			.references(() => movies.id, { onDelete: 'cascade' }),
		personId: integer('personId')
			.notNull()
			.references(() => people.id, { onDelete: 'cascade' }),
		role: text('role').notNull(), // 'actor', 'director', 'writer', 'producer', etc.
		character: text('character'), // For actors
		job: text('job'), // For crew (e.g., 'Director', 'Screenplay')
		order: integer('order'), // For cast ordering
		createdAt: integer('createdAt')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.movieId, table.personId, table.role] }),
		index('idx_movie_people_movie').on(table.movieId),
		index('idx_movie_people_person').on(table.personId),
		index('idx_movie_people_role').on(table.role),
		index('idx_movie_people_order').on(table.order)
	]
);

export const collectionsRelations = relations(collections, ({ many }) => ({
	movies: many(movies)
}));

export const moviesRelations = relations(movies, ({ one, many }) => ({
	collection: one(collections, {
		fields: [movies.collectionId],
		references: [collections.id]
	}),
	moviesGenres: many(moviesGenres),
	moviePeople: many(moviePeople)
}));

export const genresRelations = relations(genres, ({ many }) => ({
	moviesGenres: many(moviesGenres)
}));

export const moviesGenresRelations = relations(moviesGenres, ({ one }) => ({
	movie: one(movies, {
		fields: [moviesGenres.movieId],
		references: [movies.id]
	}),
	genre: one(genres, {
		fields: [moviesGenres.genreId],
		references: [genres.id]
	})
}));

export const peopleRelations = relations(people, ({ many }) => ({
	moviePeople: many(moviePeople)
}));

export const moviePeopleRelations = relations(moviePeople, ({ one }) => ({
	movie: one(movies, {
		fields: [moviePeople.movieId],
		references: [movies.id]
	}),
	person: one(people, {
		fields: [moviePeople.personId],
		references: [people.id]
	})
}));

// TV Show Tables for Enhanced Episode Tracking

export const tvShows = sqliteTable(
	'tv_shows',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tmdbId: integer('tmdb_id').notNull().unique(),
		imdbId: text('imdb_id'),
		title: text('title').notNull(),
		overview: text('overview'),
		posterPath: text('poster_path'),
		backdropPath: text('backdrop_path'),
		firstAirDate: text('first_air_date'),
		rating: real('rating'),
		episodeRuntime: integer('episode_run_time'),
		numberOfSeasons: integer('number_of_seasons'),
		numberOfEpisodes: integer('number_of_episodes'),
		status: text('status'), // 'Returning Series', 'Ended', 'Canceled', etc.
		originCountry: text('origin_country'), // JSON array of country codes
		productionCompanies: text('production_companies'), // JSON array of company objects
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		index('idx_tv_shows_tmdb_id').on(table.tmdbId),
		index('idx_tv_shows_imdb_id').on(table.imdbId),
		index('idx_tv_shows_title').on(table.title),
		index('idx_tv_shows_first_air_date').on(table.firstAirDate)
	]
);

export const seasons = sqliteTable(
	'seasons',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tvShowId: integer('tv_show_id')
			.notNull()
			.references(() => tvShows.id, { onDelete: 'cascade' }),
		seasonNumber: integer('season_number').notNull(),
		name: text('name').notNull(),
		overview: text('overview'),
		posterPath: text('poster_path'),
		airDate: text('air_date'),
		episodeCount: integer('episode_count').notNull().default(0),
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.tvShowId, table.seasonNumber] }),
		index('idx_seasons_tv_show_id').on(table.tvShowId),
		index('idx_seasons_season_number').on(table.seasonNumber),
		index('idx_seasons_air_date').on(table.airDate)
	]
);

export const episodes = sqliteTable(
	'episodes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tvShowId: integer('tv_show_id')
			.notNull()
			.references(() => tvShows.id, { onDelete: 'cascade' }),
		seasonId: integer('season_id')
			.notNull()
			.references(() => seasons.id, { onDelete: 'cascade' }),
		episodeNumber: integer('episode_number').notNull(),
		name: text('name').notNull(),
		overview: text('overview'),
		stillPath: text('still_path'),
		airDate: text('air_date'),
		runtimeMinutes: integer('runtime_minutes'),
		tmdbId: integer('tmdb_id'),
		imdbId: text('imdb_id'),
		guestStars: text('guest_stars'), // JSON array of guest star objects
		crew: text('crew'), // JSON array of crew objects
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.seasonId, table.episodeNumber] }),
		index('idx_episodes_tv_show_id').on(table.tvShowId),
		index('idx_episodes_season_id').on(table.seasonId),
		index('idx_episodes_episode_number').on(table.episodeNumber),
		index('idx_episodes_air_date').on(table.airDate),
		index('idx_episodes_tmdb_id').on(table.tmdbId)
	]
);

export const episodeWatchStatus = sqliteTable(
	'episode_watch_status',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		episodeId: integer('episode_id')
			.notNull()
			.references(() => episodes.id, { onDelete: 'cascade' }),
		watched: integer('watched', { mode: 'boolean' }).notNull().default(false),
		watchTime: integer('watch_time').notNull().default(0), // seconds watched
		totalTime: integer('total_time').notNull().default(0), // total episode duration in seconds
		completedAt: integer('completed_at'), // timestamp when marked as completed
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.episodeId] }),
		index('idx_episode_watch_status_user_id').on(table.userId),
		index('idx_episode_watch_status_episode_id').on(table.episodeId),
		index('idx_episode_watch_status_watched').on(table.watched)
	]
);

export const seasonWatchStatus = sqliteTable(
	'season_watch_status',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		seasonId: integer('season_id')
			.notNull()
			.references(() => seasons.id, { onDelete: 'cascade' }),
		episodesWatched: integer('episodes_watched').notNull().default(0),
		totalEpisodes: integer('total_episodes').notNull().default(0),
		completedAt: integer('completed_at'),
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.seasonId] }),
		index('idx_season_watch_status_user_id').on(table.userId),
		index('idx_season_watch_status_season_id').on(table.seasonId)
	]
);

export const tvShowWatchStatus = sqliteTable(
	'tv_show_watch_status',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tvShowId: integer('tv_show_id')
			.notNull()
			.references(() => tvShows.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('watching'), // 'watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'
		seasonsCompleted: integer('seasons_completed').notNull().default(0),
		totalSeasons: integer('total_seasons').notNull().default(0),
		episodesWatched: integer('episodes_watched').notNull().default(0),
		totalEpisodes: integer('total_episodes').notNull().default(0),
		rating: real('rating'),
		notes: text('notes'),
		startedAt: integer('started_at'),
		completedAt: integer('completed_at'),
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.tvShowId] }),
		index('idx_tv_show_watch_status_user_id').on(table.userId),
		index('idx_tv_show_watch_status_tv_show_id').on(table.tvShowId),
		index('idx_tv_show_watch_status_status').on(table.status)
	]
);

// Relations for TV Show tables
export const tvShowsRelations = relations(tvShows, ({ many }) => ({
	seasons: many(seasons),
	episodes: many(episodes),
	tvShowWatchStatus: many(tvShowWatchStatus)
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
	tvShow: one(tvShows, {
		fields: [seasons.tvShowId],
		references: [tvShows.id]
	}),
	episodes: many(episodes),
	seasonWatchStatus: many(seasonWatchStatus)
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
	tvShow: one(tvShows, {
		fields: [episodes.tvShowId],
		references: [tvShows.id]
	}),
	season: one(seasons, {
		fields: [episodes.seasonId],
		references: [seasons.id]
	}),
	episodeWatchStatus: many(episodeWatchStatus)
}));

export const episodeWatchStatusRelations = relations(episodeWatchStatus, ({ one }) => ({
	user: one(users, {
		fields: [episodeWatchStatus.userId],
		references: [users.id]
	}),
	episode: one(episodes, {
		fields: [episodeWatchStatus.episodeId],
		references: [episodes.id]
	})
}));

export const seasonWatchStatusRelations = relations(seasonWatchStatus, ({ one }) => ({
	user: one(users, {
		fields: [seasonWatchStatus.userId],
		references: [users.id]
	}),
	season: one(seasons, {
		fields: [seasonWatchStatus.seasonId],
		references: [seasons.id]
	})
}));

export const tvShowWatchStatusRelations = relations(tvShowWatchStatus, ({ one }) => ({
	user: one(users, {
		fields: [tvShowWatchStatus.userId],
		references: [users.id]
	}),
	tvShow: one(tvShows, {
		fields: [tvShowWatchStatus.tvShowId],
		references: [tvShows.id]
	})
});
