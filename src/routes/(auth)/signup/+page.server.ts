import { fail, redirect } from '@sveltejs/kit';
import { generateIdFromEntropySize } from 'lucia';
import { hash } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { lucia } from '$lib/server/auth';
import { getCsrfToken } from '$lib/server/csrf';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	return {
		csrfToken: getCsrfToken({ cookies })
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const username = formData.get('username');
		const password = formData.get('password');

		if (
			typeof username !== 'string' ||
			username.length < 3 ||
			username.length > 31 ||
			!/^[a-z0-9_-]+$/.test(username)
		) {
			return fail(400, {
				message: 'Invalid username'
			});
		}
		if (typeof password !== 'string' || password.length < 6 || password.length > 255) {
			return fail(400, {
				message: 'Invalid password'
			});
		}

		const existingUser = await db.select().from(users).where(eq(users.username, username)).get();
		if (existingUser) {
			return fail(400, {
				message: 'Username already taken'
			});
		}

		const passwordHash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
		const userId = generateIdFromEntropySize(10);

		try {
			await db.insert(users).values({
				id: userId,
				username,
				passwordHash,
				role: 'USER'
			});

			const session = await lucia.createSession(userId, {
				created_at: Date.now(),
				expires_at: Date.now() + 86400 * 1000
			});
			const sessionCookie = lucia.createSessionCookie(session.id);
			cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes
			});
		} catch (e) {
			console.error(e);
			return fail(500, {
				message: 'An unknown error occurred'
			});
		}
		return redirect(302, '/');
	}
};
