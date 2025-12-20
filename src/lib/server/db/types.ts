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
	is4K: 0 | 1;
	isHD: 0 | 1;
	collectionId: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface MovieRecord extends Omit<MovieRow, 'is4K' | 'isHD'> {
	is4K: boolean;
	isHD: boolean;
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
