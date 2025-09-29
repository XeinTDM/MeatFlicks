import { setup } from 'svelte-match-media';

setup({
	desktop: 'screen and (min-width: 768px)',
	mobile: 'screen and (max-width: 767px)'
});
