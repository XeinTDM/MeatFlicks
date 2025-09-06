import { SvelteKitAuth } from "@auth/sveltekit";
import { authOptions } from "$lib/authUtils";

export const { handle } = SvelteKitAuth(authOptions as any);