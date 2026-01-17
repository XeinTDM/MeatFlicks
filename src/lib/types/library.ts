import type { CollectionRecord, GenreRecord, MediaSummary } from '$lib/server/db';

export type CastMember = {
	id: string;
	name: string;
	character: string;
};

export type GenreSummary = GenreRecord;

export type LibraryMedia = MediaSummary & {
	releaseDate: MediaSummary['releaseDate'] | string | null;
	trailerUrl?: string | null;
	media_type?: string | null;
	genres?: GenreSummary[] | string[];
	cast?: CastMember[];
	imdbId?: string | null;
	canonicalPath?: string | null;
	addedAt?: number | null;
	mediaType?: string | null;
	season?: number | null;
	episode?: number | null;
};

// Compatibility alias
export type LibraryMovie = LibraryMedia;

export type LibraryCollection = CollectionRecord & {
	media: LibraryMedia[];
	// Compatibility
	movies?: LibraryMedia[];
};

export type LibraryGenre = GenreRecord & {
	slug: string;
	media: LibraryMedia[];
	// Compatibility
	movies?: LibraryMedia[];
};

export type HomeLibrary = {
	trendingMovies: LibraryMedia[];
	trendingTv?: LibraryMedia[];
	collections: LibraryCollection[];
	genres: LibraryGenre[];
	popularTv?: LibraryMedia[];
};