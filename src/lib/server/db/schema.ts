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
        index('idx_movies_rating').on(table.rating)
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

export const watchlist = sqliteTable(
    'watchlist',
    {
        id: text('id').primaryKey(),
        movieData: text('movieData').notNull(),
        addedAt: integer('addedAt')
            .notNull()
            .$defaultFn(() => Date.now())
    },
    (table) => [index('idx_watchlist_addedAt').on(table.addedAt)]
);

// Relations
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
