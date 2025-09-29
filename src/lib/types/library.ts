import type { Collection, Genre, Movie } from '@prisma/client';

export type CastMember = {
	id: number;
	name: string;
	character: string;
};

export type GenreSummary = Pick<Genre, 'id' | 'name'>;

export type LibraryMovie = Omit<Movie, 'releaseDate'> & {
	releaseDate: Movie['releaseDate'] | string | null;
	trailerUrl?: string | null;
	media_type?: string | null;
	genres?: GenreSummary[];
	cast?: CastMember[];
	imdbId?: string | null;
	canonicalPath?: string;
	addedAt?: string;
};

export type LibraryCollection = Collection & {
	movies: LibraryMovie[];
};

export type LibraryGenre = Genre & {
	slug: string;
	movies: LibraryMovie[];
};

export type HomeLibrary = {
	trendingMovies: LibraryMovie[];
	collections: LibraryCollection[];
	genres: LibraryGenre[];
};
