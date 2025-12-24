import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// https://svelte.dev/docs/kit/integrations
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			'@': './src',
			types: '$lib/types'
		}
	}
};

export default config;
