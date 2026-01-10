import { Lucia } from 'lucia';
import { dev } from '$app/environment';
import { DrizzleSQLiteAdapter } from '@lucia-auth/adapter-drizzle';
import { db } from './db';
import { sessions, users } from './db/schema';

const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !dev
		}
	},
	getSessionAttributes: (attributes) => {
		return {
			createdAt: attributes.created_at,
			expiresAt: attributes.expires_at
		};
	},
	getUserAttributes: (attributes) => {
		return {
			username: attributes.username,
			role: attributes.role
		};
	}
});

declare module 'lucia' {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: DatabaseUserAttributes;
		DatabaseSessionAttributes: DatabaseSessionAttributes;
	}
}

interface DatabaseUserAttributes {
	username: string;
	role: 'ADMIN' | 'USER';
}

interface DatabaseSessionAttributes {
	created_at: number;
	expires_at: number;
}
