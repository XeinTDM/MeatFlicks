import { SvelteKitAuth } from "@auth/sveltekit";
import { authOptions } from "$lib/server";

const handler = SvelteKitAuth(authOptions as any);

export { handler as GET, handler as POST };
