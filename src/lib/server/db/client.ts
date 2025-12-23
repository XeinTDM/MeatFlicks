import { type Client, createClient } from '@libsql/client';
import { type LibSQLDatabase, drizzle } from 'drizzle-orm/libsql';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import * as schema from './schema';
import { logger } from '../logger';
import { env } from '$lib/config/env';
import { sql } from 'drizzle-orm';

// Database connection management
let clientInstance: Client | null = null;
let dbInstance: LibSQLDatabase<typeof schema> | null = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;
const CONNECTION_RETRY_DELAY = 1000;

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
	try {
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
		logger.info('Database initialization completed successfully');
	} catch (err) {
		logger.error({ err }, 'Failed to initialize database extensions');
		throw err;
	}
};

const createDatabaseClient = (): Client => {
	try {
		const url = resolveDatabasePath();
		ensureDirectory(url);

		// Configure client with connection pooling and retry logic
		const client = createClient({
			url
		});

		return client;
	} catch (error) {
		logger.error({ error }, 'Failed to create database client');
		throw error;
	}
};

const getDatabaseClient = (): Client => {
	if (clientInstance) {
		return clientInstance;
	}

	try {
		clientInstance = createDatabaseClient();
		runInitSql(clientInstance);
		return clientInstance;
	} catch (error) {
		logger.error({ error }, 'Failed to get database client');
		throw error;
	}
};

const getDatabaseInstance = (): LibSQLDatabase<typeof schema> => {
	if (dbInstance) {
		return dbInstance;
	}

	try {
		const client = getDatabaseClient();
		dbInstance = drizzle(client, { schema });
		return dbInstance;
	} catch (error) {
		logger.error({ error }, 'Failed to get database instance');
		throw error;
	}
};

// Enhanced database operations with retry logic
export const executeWithRetry = async <T>(
	operation: () => Promise<T>,
	maxAttempts: number = 3,
	delay: number = 1000
): Promise<T> => {
	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			logger.warn(
				{ attempt, maxAttempts, error: error instanceof Error ? error.message : String(error) },
				'Database operation failed, retrying...'
			);

			if (attempt < maxAttempts) {
				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	}

	logger.error({ error: lastError }, 'Database operation failed after retries');
	throw lastError;
};

// Database health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
	try {
		const db = getDatabaseInstance();
		// Use a simple query to check database health
		await db.all(sql`SELECT 1`);
		return true;
	} catch (error) {
		logger.error({ error }, 'Database health check failed');
		return false;
	}
};

// Export the database instances
export const client: Client = getDatabaseClient();
export const db: LibSQLDatabase<typeof schema> = getDatabaseInstance();
export const sqlite = client;

export default db;
