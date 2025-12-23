export interface GenreRecord {
	id: number;
	name: string;
}

export interface CollectionRecord {
	id: number;
	name: string;
	slug: string;
	description: string | null;
}

export interface PersonRecord {
	id: number;
	tmdbId: number;
	name: string;
	biography: string | null;
	birthday: string | null;
	deathday: string | null;
	placeOfBirth: string | null;
	profilePath: string | null;
	popularity: number | null;
	knownForDepartment: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface MoviePersonRecord {
	movieId: string;
	personId: number;
	role: string;
	character: string | null;
	job: string | null;
	order: number | null;
	createdAt: number;
}

export interface PersonSearchResult extends PersonRecord {
	score: number;
}

export interface MovieRow {
	numericId: number;
	id: string;
	tmdbId: number;
	title: string;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	releaseDate: string | null;
	rating: number | null;
	durationMinutes: number | null;
	is4K: boolean;
	isHD: boolean;
	collectionId: number | null;
	trailerUrl: string | null;
	imdbId: string | null;
	canonicalPath: string | null;
	addedAt: number | null;
	mediaType: string;
	createdAt: number;
	updatedAt: number;
}

export interface MovieRecord extends MovieRow {
	genres: GenreRecord[];
}

export interface MovieSearchResult extends MovieRecord {
	score: number;
}

export type MovieSummary = Omit<
	MovieRecord,
	| 'numericId'
	| 'createdAt'
	| 'updatedAt'
	| 'tmdbId'
	| 'durationMinutes'
	| 'collectionId'
	| 'genres'
	| 'is4K'
	| 'isHD'
> & {
	tmdbId?: number;
	durationMinutes?: number | null;
	collectionId?: number | null;
	genres: GenreRecord[] | string[];
	is4K?: boolean;
	isHD?: boolean;
};

export type SqliteTransaction<T> = () => T;
