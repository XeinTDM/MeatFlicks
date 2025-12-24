import type { CollectionRecord, GenreRecord, MovieSummary } from '$lib/server/db';

export type CastMember = {
	id: number;
	name: string;
	character: string;
};

export type GenreSummary = GenreRecord;

export type LibraryMovie = MovieSummary & {
	releaseDate: MovieSummary['releaseDate'] | string | null;
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

export type LibraryCollection = CollectionRecord & {
	movies: LibraryMovie[];
};

export type LibraryGenre = GenreRecord & {
	slug: string;
	movies: LibraryMovie[];
};

export type HomeLibrary = {
	trendingMovies: LibraryMovie[];
	collections: LibraryCollection[];
	genres: LibraryGenre[];
};
