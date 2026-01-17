import 'dotenv/config';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { env } from './src/lib/config/env';
import { resolve } from 'node:path';
import { isAbsolute } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const resolveDatabasePath = () => {
	const target = env.SQLITE_DB_PATH;
	const absPath = isAbsolute(target) ? target : resolve(process.cwd(), target);
	return `file:${absPath}`;
};

const ensureDirectory = (dbPath: string) => {
	const folder = dirname(dbPath.replace(/^file:/, ''));
	mkdirSync(folder, { recursive: true });
};

async function main() {
	try {
		const url = resolveDatabasePath();
		ensureDirectory(url);

		const sqlite = createClient({
			url
		});

		const db = drizzle(sqlite);

		await migrate(db, { migrationsFolder: './drizzle/migrations' });
		console.log('Migrations completed successfully.');
		await sqlite.close();
	} catch (error) {
		console.error('Error running migrations:', error);
		process.exit(1);
	}
}

main();
