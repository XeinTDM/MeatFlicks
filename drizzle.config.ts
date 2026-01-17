import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: process.env.DB_SCHEMA_PATH || './src/lib/server/db/schema.ts',
	out: process.env.DB_OUT_PATH || './drizzle/migrations',
	dialect: 'sqlite',
	dbCredentials: {
		url: process.env.SQLITE_DB_PATH || 'data/meatflicks.db'
	}
});
