export type NavigationItem = {
	label: string;
	href?: string;
	onSelect?: () => void;
};

export const primaryNav: NavigationItem[] = [
	{ label: 'Home', href: '/' },
	{ label: 'Search', href: '/search' }
];

export const browseNav: NavigationItem[] = [
	{ label: 'Movies', href: '/explore/movies' },
	{ label: 'TV Series', href: '/explore/tv-shows' },
	{ label: 'Anime', href: '/explore/anime' },
	{ label: 'Manga', href: '/explore/manga' }
];

export const libraryNav: () => NavigationItem[] = () => [];
