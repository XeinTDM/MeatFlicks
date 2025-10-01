import DatabaseConstructor from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

export type SQLiteDatabase = BetterSqlite3.Database;

type GlobalWithDb = typeof globalThis & {
	__meatflicksDb?: BetterSqlite3.Database;
};

const DEFAULT_DB_PATH = 'data/meatflicks.db';

const resolveDatabasePath = () => {
	const configured = process.env.SQLITE_DB_PATH?.trim();
	const target = configured && configured.length > 0 ? configured : DEFAULT_DB_PATH;
	return isAbsolute(target) ? target : resolve(process.cwd(), target);
};

const ensureDirectory = (dbPath: string) => {
	const folder = dirname(dbPath);
	mkdirSync(folder, { recursive: true });
};

const runMigrations = (db: BetterSqlite3.Database) => {
	db.exec(`
		CREATE TABLE IF NOT EXISTS schema_info (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS collections (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			slug TEXT NOT NULL UNIQUE,
			description TEXT
		);

		CREATE TABLE IF NOT EXISTS movies (
			numericId INTEGER PRIMARY KEY AUTOINCREMENT,
			id TEXT NOT NULL UNIQUE,
			tmdbId INTEGER NOT NULL UNIQUE,
			title TEXT NOT NULL,
			overview TEXT,
			posterPath TEXT,
			backdropPath TEXT,
			releaseDate TEXT,
			rating REAL,
			durationMinutes INTEGER,
			is4K INTEGER NOT NULL DEFAULT 0,
			isHD INTEGER NOT NULL DEFAULT 0,
			collectionId INTEGER REFERENCES collections(id) ON DELETE SET NULL,
			createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
			updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
		);

		CREATE TABLE IF NOT EXISTS genres (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE
		);

		CREATE TABLE IF NOT EXISTS movies_genres (
			movieId TEXT NOT NULL,
			genreId INTEGER NOT NULL,
			PRIMARY KEY (movieId, genreId),
			FOREIGN KEY (movieId) REFERENCES movies(id) ON DELETE CASCADE,
			FOREIGN KEY (genreId) REFERENCES genres(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS cache (
			key TEXT PRIMARY KEY,
			data TEXT NOT NULL,
			expiresAt INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_movies_tmdbId ON movies(tmdbId);
		CREATE INDEX IF NOT EXISTS idx_movies_collectionId ON movies(collectionId);
		CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating);
		CREATE INDEX IF NOT EXISTS idx_cache_expiresAt ON cache(expiresAt);
		CREATE INDEX IF NOT EXISTS idx_movies_genres_movie ON movies_genres(movieId);
		CREATE INDEX IF NOT EXISTS idx_movies_genres_genre ON movies_genres(genreId);
	`);

	db.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS movie_fts USING fts5(
			title,
			overview,
			movieId UNINDEXED
		);

		CREATE TRIGGER IF NOT EXISTS movies_ai AFTER INSERT ON movies BEGIN
			INSERT INTO movie_fts(rowid, title, overview, movieId)
			VALUES (new.numericId, new.title, coalesce(new.overview, ''), new.id);
		END;

		CREATE TRIGGER IF NOT EXISTS movies_ad AFTER DELETE ON movies BEGIN
			INSERT INTO movie_fts(movie_fts, rowid, title, overview, movieId)
			VALUES ('delete', old.numericId, old.title, coalesce(old.overview, ''), old.id);
		END;

		CREATE TRIGGER IF NOT EXISTS movies_au AFTER UPDATE ON movies BEGIN
			INSERT INTO movie_fts(movie_fts, rowid, title, overview, movieId)
			VALUES ('delete', old.numericId, old.title, coalesce(old.overview, ''), old.id);
			INSERT INTO movie_fts(rowid, title, overview, movieId)
			VALUES (new.numericId, new.title, coalesce(new.overview, ''), new.id);
		END;

		CREATE TRIGGER IF NOT EXISTS movies_set_updated_at
		AFTER UPDATE ON movies
		BEGIN
			UPDATE movies
			SET updatedAt = (strftime('%s','now') * 1000)
			WHERE numericId = new.numericId;
		END;

		INSERT INTO movie_fts(movie_fts) VALUES('rebuild');
	`);
};

const buildDatabase = () => {
	const dbPath = resolveDatabasePath();
	ensureDirectory(dbPath);
	const db = new DatabaseConstructor(dbPath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	runMigrations(db);
	return db;
};

const globalRef = globalThis as GlobalWithDb;

export const sqlite = globalRef.__meatflicksDb ?? (() => {
	const db = buildDatabase();
	globalRef.__meatflicksDb = db;
	return db;
})();

export default sqlite;
