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
	id: string;
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

export interface MediaPersonRecord {
	mediaId: string;
	personId: string;
	role: string;
	character: string | null;
	job: string | null;
	order: number | null;
	createdAt: number;
}

export type MoviePersonRecord = MediaPersonRecord;

export interface PersonSearchResult extends PersonRecord {
	score: number;
}

export interface MediaRow {
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
	
	// TV specific
	status?: string | null;
	numberOfSeasons?: number | null;
	numberOfEpisodes?: number | null;
	productionCompanies?: string | null;
	streamingProviders?: string | null;

	createdAt: number;
	updatedAt: number;
}

export interface MediaRecord extends MediaRow {
	genres: GenreRecord[];
}

export interface MediaSearchResult extends MediaRecord {
	score: number;
}

export type MediaSummary = Omit<
	MediaRecord,
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
	
	// TV fields
	status?: string | null;
	numberOfSeasons?: number | null;
	numberOfEpisodes?: number | null;
};

// Compatibility aliases
export type MovieRow = MediaRow;
export type MovieRecord = MediaRecord;
export type MovieSummary = MediaSummary;

export type SqliteTransaction<T> = () => T;