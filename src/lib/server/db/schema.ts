import { sqliteTable, text, integer, real, primaryKey, index, customType } from 'drizzle-orm/sqlite-core';
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
        collectionId: integer('collectionId').references(() => collections.id, { onDelete: 'set null' }),
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
        movieData: text('movie_data').notNull(), // JSON string of the movie data
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



export const collectionsRelations = relations(collections, ({ many }) => ({
    movies: many(movies)
}));

export const moviesRelations = relations(movies, ({ one, many }) => ({
    collection: one(collections, {
        fields: [movies.collectionId],
        references: [collections.id]
    }),
    moviesGenres: many(moviesGenres)
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
