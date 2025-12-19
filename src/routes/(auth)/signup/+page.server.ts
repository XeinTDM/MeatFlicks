import { fail, redirect } from '@sveltejs/kit';
import { generateIdFromEntropySize } from 'lucia';
import { hash } from '@node-rs/argon2';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { lucia } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user) {
        throw redirect(302, '/');
    }
    return {};
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

        // check if user exists
        const existingUser = await db.select().from(users).where(eq(users.username, username)).get();
        if (existingUser) {
            return fail(400, {
                message: 'Username already taken'
            });
        }

        const passwordHash = await hash(password, {
            // recommended minimum parameters
            memoryCost: 19456,
            timeCost: 2,
            outputLen: 32,
            parallelism: 1
        });
        const userId = generateIdFromEntropySize(10); // 16 characters long

        try {
            await db.insert(users).values({
                id: userId,
                username,
                passwordHash
            });

            const session = await lucia.createSession(userId, {});
            const sessionCookie = lucia.createSessionCookie(session.id);
            cookies.set(sessionCookie.name, sessionCookie.value, {
                path: '.',
                ...sessionCookie.attributes
            });
        } catch (e) {
            // db error
            console.error(e);
            return fail(500, {
                message: 'An unknown error occurred'
            });
        }
        return redirect(302, '/');
    }
};
