import { SvelteKitAuth } from '@auth/sveltekit';
import { authOptions } from '$lib/server';

export const { handle } = SvelteKitAuth(authOptions as any);