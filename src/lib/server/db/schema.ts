import {
	sqliteTable,
	text,
	integer,
	real,
	primaryKey,
	index,
	unique
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { createId } from '../id';

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

export const media = sqliteTable(
	'media',
	{
		numericId: integer('numericId').primaryKey({ autoIncrement: true }),
		id: text('id')
			.notNull()
			.unique()
			.$defaultFn(() => createId()),
		tmdbId: integer('tmdbId').notNull().unique(),
		imdbId: text('imdbId'),
		title: text('title').notNull(),
		overview: text('overview'),
		posterPath: text('posterPath'),
		backdropPath: text('backdropPath'),
		releaseDate: text('releaseDate'),
		rating: real('rating'),
		durationMinutes: integer('durationMinutes'),
		is4K: integer('is4K', { mode: 'boolean' }).notNull().default(false),
		isHD: integer('isHD', { mode: 'boolean' }).notNull().default(false),
		language: text('language'),
		popularity: real('popularity'),
		collectionId: integer('collectionId').references(() => collections.id, {
			onDelete: 'set null'
		}),
		trailerUrl: text('trailerUrl'),
		canonicalPath: text('canonicalPath'),
		addedAt: integer('addedAt'),
		mediaType: text('mediaType').notNull().default('movie'), // 'movie', 'tv', 'anime'
		streamingProviders: text('streamingProviders'),

		// TV Specific columns
		status: text('status'),
		numberOfSeasons: integer('numberOfSeasons'),
		numberOfEpisodes: integer('numberOfEpisodes'),
		productionCompanies: text('productionCompanies'),

		createdAt: integer('createdAt')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updatedAt')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		index('idx_media_tmdbId').on(table.tmdbId),
		index('idx_media_imdbId').on(table.imdbId),
		index('idx_media_collectionId').on(table.collectionId),
		index('idx_media_rating').on(table.rating),
		index('idx_media_language').on(table.language),
		index('idx_media_popularity').on(table.popularity),
		index('idx_media_releaseDate').on(table.releaseDate),
		index('idx_media_mediaType').on(table.mediaType),
		index('idx_media_addedAt').on(table.addedAt),
		index('idx_media_common_sort').on(table.rating, table.releaseDate, table.title)
	]
);

export const genres = sqliteTable('genres', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique()
});

export const mediaGenres = sqliteTable(
	'media_genres',
	{
		mediaId: text('mediaId')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		genreId: integer('genreId')
			.notNull()
			.references(() => genres.id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.mediaId, table.genreId] }),
		index('idx_media_genres_media').on(table.mediaId),
		index('idx_media_genres_genre').on(table.genreId)
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
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['ADMIN', 'USER'] })
		.notNull()
		.default('USER')
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	expiresAt: integer('expires_at').notNull()
});

export const watchlistFolders = sqliteTable(
	'watchlist_folders',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		color: text('color'),
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		index('idx_watchlist_folders_user').on(table.userId),
		index('idx_watchlist_folders_name').on(table.name)
	]
);

export const watchlistTags = sqliteTable(
	'watchlist_tags',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color'),
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		index('idx_watchlist_tags_user').on(table.userId),
		index('idx_watchlist_tags_name').on(table.name)
	]
);

export const watchlistItemTags = sqliteTable(
	'watchlist_item_tags',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		tagId: integer('tag_id')
			.notNull()
			.references(() => watchlistTags.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.mediaId, table.tagId] }),
		index('idx_watchlist_item_tags_user').on(table.userId),
		index('idx_watchlist_item_tags_media').on(table.mediaId),
		index('idx_watchlist_item_tags_tag').on(table.tagId)
	]
);

export const watchlist = sqliteTable(
	'watchlist',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		addedAt: integer('added_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		folderId: integer('folder_id').references(() => watchlistFolders.id, { onDelete: 'set null' })
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.mediaId] }),
		index('idx_watchlist_user').on(table.userId),
		index('idx_watchlist_addedAt').on(table.addedAt),
		index('idx_watchlist_folder').on(table.folderId)
	]
);

export const watchHistory = sqliteTable(
	'watch_history',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
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
		filters: text('filters'),
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
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		mediaType: text('media_type').notNull(),
		progress: integer('progress').notNull(),
		duration: integer('duration').notNull(),
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
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		tmdbId: integer('tmdbId').notNull().unique(),
		name: text('name').notNull(),
		biography: text('biography'),
		birthday: text('birthday'),
		deathday: text('deathday'),
		placeOfBirth: text('placeOfBirth'),
		profilePath: text('profilePath'),
		popularity: real('popularity'),
		knownForDepartment: text('knownForDepartment'),
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

export const mediaPeople = sqliteTable(
	'media_people',
	{
		mediaId: text('mediaId')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		personId: text('personId')
			.notNull()
			.references(() => people.id, { onDelete: 'cascade' }),
		role: text('role').notNull(),
		character: text('character'),
		job: text('job'),
		order: integer('order'),
		createdAt: integer('createdAt')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		primaryKey({ columns: [table.mediaId, table.personId, table.role] }),
		index('idx_media_people_media').on(table.mediaId),
		index('idx_media_people_person').on(table.personId),
		index('idx_media_people_role').on(table.role),
		index('idx_media_people_order').on(table.order)
	]
);

// Compatibility aliases
export const movies = media;
export const moviesGenres = mediaGenres;
export const moviePeople = mediaPeople;
export const tvShows = media;
export const tvShowsGenres = mediaGenres;

export const collectionsRelations = relations(collections, ({ many }) => ({
	media: many(media)
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
	collection: one(collections, {
		fields: [media.collectionId],
		references: [collections.id]
	}),
	mediaGenres: many(mediaGenres),
	mediaPeople: many(mediaPeople),
	seasons: many(seasons),
	episodes: many(episodes),
	watchStatus: many(tvShowWatchStatus)
}));

export const genresRelations = relations(genres, ({ many }) => ({
	mediaGenres: many(mediaGenres)
}));

export const mediaGenresRelations = relations(mediaGenres, ({ one }) => ({
	media: one(media, {
		fields: [mediaGenres.mediaId],
		references: [media.id]
	}),
	genre: one(genres, {
		fields: [mediaGenres.genreId],
		references: [genres.id]
	})
}));

export const peopleRelations = relations(people, ({ many }) => ({
	mediaPeople: many(mediaPeople)
}));

export const mediaPeopleRelations = relations(mediaPeople, ({ one }) => ({
	media: one(media, {
		fields: [mediaPeople.mediaId],
		references: [media.id]
	}),
	person: one(people, {
		fields: [mediaPeople.personId],
		references: [people.id]
	})
}));

export const seasons = sqliteTable(
	'seasons',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
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
		unique('unq_seasons_media_number').on(table.mediaId, table.seasonNumber),
		index('idx_seasons_media_id').on(table.mediaId),
		index('idx_seasons_season_number').on(table.seasonNumber),
		index('idx_seasons_air_date').on(table.airDate)
	]
);

export const episodes = sqliteTable(
	'episodes',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		seasonId: text('season_id')
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
		guestStars: text('guest_stars'),
		crew: text('crew'),
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		unique('unq_episodes_media_season_number').on(
			table.mediaId,
			table.seasonId,
			table.episodeNumber
		),
		index('idx_episodes_media_id').on(table.mediaId),
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
		episodeId: text('episode_id')
			.notNull()
			.references(() => episodes.id, { onDelete: 'cascade' }),
		watched: integer('watched', { mode: 'boolean' }).notNull().default(false),
		watchTime: integer('watch_time').notNull().default(0),
		totalTime: integer('total_time').notNull().default(0),
		completedAt: integer('completed_at'),
		createdAt: integer('created_at')
			.notNull()
			.$defaultFn(() => Date.now()),
		updatedAt: integer('updated_at')
			.notNull()
			.$defaultFn(() => Date.now())
	},
	(table) => [
		unique('unq_episode_watch_status_user_episode').on(table.userId, table.episodeId),
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
		seasonId: text('season_id')
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
		unique('unq_season_watch_status_user_season').on(table.userId, table.seasonId),
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
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('watching'),
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
		unique('unq_tv_show_watch_status_user_media').on(table.userId, table.mediaId),
		index('idx_tv_show_watch_status_user_id').on(table.userId),
		index('idx_tv_show_watch_status_media_id').on(table.mediaId),
		index('idx_tv_show_watch_status_status').on(table.status)
	]
);

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
	media: one(media, {
		fields: [seasons.mediaId],
		references: [media.id]
	}),
	episodes: many(episodes),
	seasonWatchStatus: many(seasonWatchStatus)
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
	media: one(media, {
		fields: [episodes.mediaId],
		references: [media.id]
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
	media: one(media, {
		fields: [tvShowWatchStatus.mediaId],
		references: [media.id]
	})
}));

export const watchlistRelations = relations(watchlist, ({ one, many }) => ({
	user: one(users, {
		fields: [watchlist.userId],
		references: [users.id]
	}),
	folder: one(watchlistFolders, {
		fields: [watchlist.folderId],
		references: [watchlistFolders.id]
	}),
	tags: many(watchlistItemTags)
}));

export const watchlistFoldersRelations = relations(watchlistFolders, ({ one, many }) => ({
	user: one(users, {
		fields: [watchlistFolders.userId],
		references: [users.id]
	}),
	items: many(watchlist)
}));

export const watchlistTagsRelations = relations(watchlistTags, ({ one, many }) => ({
	user: one(users, {
		fields: [watchlistTags.userId],
		references: [users.id]
	}),
	itemTags: many(watchlistItemTags)
}));

export const watchlistItemTagsRelations = relations(watchlistItemTags, ({ one }) => ({
	user: one(users, {
		fields: [watchlistItemTags.userId],
		references: [users.id]
	}),
	tag: one(watchlistTags, {
		fields: [watchlistItemTags.tagId],
		references: [watchlistTags.id]
	}),
	watchlist: one(watchlist, {
		fields: [watchlistItemTags.userId, watchlistItemTags.mediaId],
		references: [watchlist.userId, watchlist.mediaId]
	})
}));
