import { z } from 'zod';
import { TmdbConfigSchema } from './tmdb.schemas';

export type TmdbConfiguration = z.infer<typeof TmdbConfigSchema>;

export interface TmdbMovieExtras {
	tmdbId: number;
	imdbId: string | null;
	cast: { id: number; name: string; character?: string | null; profilePath?: string | null }[];
	trailerUrl: string | null;
	runtime: number | null;
	releaseDate: string | null;
	productionCompanies: { id: number; name: string; logoPath: string | null }[];
	productionCountries: { iso: string; name: string }[];
	voteCount: number | null;
	logoPath: string | null;
}

export interface TmdbMovieGenre {
	id: number;
	name: string;
}

export interface TmdbMovieDetails extends TmdbMovieExtras {
	found: boolean;
	title: string | null;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	rating: number | null;
	genres: TmdbMovieGenre[];
}

export interface TmdbTvDetails {
	found: boolean;
	tmdbId: number;
	imdbId: string | null;
	name: string | null;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	rating: number | null;
	genres: TmdbMovieGenre[];
	cast: { id: number; name: string; character?: string | null; profilePath?: string | null }[];
	trailerUrl: string | null;
	episodeRuntimes: number[];
	firstAirDate: string | null;
	seasonCount: number | null;
	episodeCount: number | null;
	status: string | null;

	seasons: TmdbTvSeason[];
	productionCompanies: { id: number; name: string; logoPath: string | null }[];
	productionCountries: { iso: string; name: string }[];
	voteCount: number | null;
	logoPath: string | null;
}

export interface TmdbTvSeason {
	id: number;
	name: string;
	overview: string | null;
	posterPath: string | null;
	seasonNumber: number;
	episodeCount: number;
	airDate: string | null;
	episodes?: TmdbTvEpisode[];
}

export interface TmdbTvEpisode {
	id: number;
	name: string;
	overview: string | null;
	episodeNumber: number;
	seasonNumber: number;
	airDate: string | null;
	stillPath: string | null;
	voteAverage: number | null;
	runtime: number | null;
}

export interface TmdbPersonCredit {
	id: number;
	title: string;
	character?: string;
	job?: string;
	department?: string;
	posterPath: string | null;
	mediaType: 'movie' | 'tv';
	year: string;
}

export interface TmdbPersonDetails {
	id: number;
	name: string;
	biography: string;
	birthday: string | null;
	deathday: string | null;
	placeOfBirth: string | null;
	profilePath: string | null;
	knownFor: TmdbPersonCredit[];
	images: string[];
	popularity?: number | null;
}

export interface TmdbMediaCredits {
	cast: { id: number; name: string; character: string }[];
	crew: { id: number; name: string; department: string; job: string }[];
}
