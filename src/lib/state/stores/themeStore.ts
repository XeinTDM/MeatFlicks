import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

const userPrefersDark = browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme: Theme = browser
	? (localStorage.getItem('theme') as Theme) || (userPrefersDark ? 'dark' : 'light')
	: 'dark';

export const theme = writable<Theme>(initialTheme);

theme.subscribe((value) => {
	if (browser) {
		document.documentElement.classList.toggle('dark', value === 'dark');
		document.documentElement.classList.toggle('light', value === 'light');
		localStorage.setItem('theme', value);
	}
});
