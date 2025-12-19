import { type Client, createClient } from '@libsql/client';
import { type LibSQLDatabase, drizzle } from 'drizzle-orm/libsql';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import * as schema from './schema';
import { logger } from '../logger';
import { env } from '$lib/config/env';

const resolveDatabasePath = () => {
	const target = env.SQLITE_DB_PATH;
	const absPath = isAbsolute(target) ? target : resolve(process.cwd(), target);
	return `file:${absPath}`;
};

const ensureDirectory = (dbPath: string) => {
	const folder = dirname(dbPath.replace(/^file:/, ''));
	mkdirSync(folder, { recursive: true });
};

const runInitSql = async (client: Client) => {
	await client.executeMultiple(`
		CREATE TABLE IF NOT EXISTS schema_info (key TEXT PRIMARY KEY, value TEXT NOT NULL);
		
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

type GlobalWithDb = typeof globalThis & {
	__meatflicksClient?: Client;
	__meatflicksDb?: LibSQLDatabase<typeof schema>;
};

const globalRef = globalThis as GlobalWithDb;

export const client: Client = globalRef.__meatflicksClient ?? (() => {
	const url = resolveDatabasePath();
	ensureDirectory(url);
	const c = createClient({ url });
	globalRef.__meatflicksClient = c;

	runInitSql(c).catch((err) => logger.error({ err }, 'Failed to initialize database extensions'));

	return c;
})();

export const db = (globalRef.__meatflicksDb as LibSQLDatabase<typeof schema>) ?? (() => {
	const d = drizzle(client, { schema });
	globalRef.__meatflicksDb = d;
	return d;
})();

export const sqlite = client;

export default db;

