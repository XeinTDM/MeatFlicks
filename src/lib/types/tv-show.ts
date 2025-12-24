export interface TVShow {
	id: number;
	tmdbId: number;
	imdbId?: string | null;
	title: string;
	overview?: string | null;
	posterPath?: string | null;
	backdropPath?: string | null;
	firstAirDate?: string | null;
	rating?: number | null;
	episodeRuntime?: number | null;
	numberOfSeasons?: number | null;
	numberOfEpisodes?: number | null;
	status?: string | null;
	originCountry?: string | null;
	productionCompanies?: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface Season {
	id: number;
	tvShowId: number;
	seasonNumber: number;
	name: string;
	overview?: string | null;
	posterPath?: string | null;
	airDate?: string | null;
	episodeCount: number;
	createdAt: number;
	updatedAt: number;
}

export interface Episode {
	id: number;
	tvShowId: number;
	seasonId: number;
	episodeNumber: number;
	name: string;
	overview?: string | null;
	stillPath?: string | null;
	airDate?: string | null;
	runtimeMinutes?: number | null;
	tmdbId?: number | null;
	imdbId?: string | null;
	guestStars?: string | null;
	crew?: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface EpisodeWatchStatus {
	id: number;
	userId: string;
	episodeId: number;
	watched: boolean;
	watchTime: number;
	totalTime: number;
	completedAt?: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface SeasonWatchStatus {
	id: number;
	userId: string;
	seasonId: number;
	episodesWatched: number;
	totalEpisodes: number;
	completedAt?: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface TVShowWatchStatus {
	id: number;
	userId: string;
	tvShowId: number;
	status: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';
	seasonsCompleted: number;
	totalSeasons: number;
	episodesWatched: number;
	totalEpisodes: number;
	rating?: number | null;
	notes?: string | null;
	startedAt?: number | null;
	completedAt?: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface EpisodeWithStatus extends Episode {
	watchStatus?: EpisodeWatchStatus | null;
}

export interface SeasonWithStatus extends Season {
	episodes?: EpisodeWithStatus[];
	watchStatus?: SeasonWatchStatus | null;
}

export interface TVShowWithStatus extends TVShow {
	seasons?: SeasonWithStatus[];
	watchStatus?: TVShowWatchStatus | null;
}

export interface ContinueWatchingItem {
	tvShow: TVShow;
	season: Season;
	episode: Episode;
	watchStatus: EpisodeWatchStatus;
}

export interface UserTVShowStats {
	totalShows: number;
	watching: number;
	completed: number;
	onHold: number;
	dropped: number;
	planToWatch: number;
	totalEpisodesWatched: number;
}

export interface TmdbTvEpisode {
	id: number;
	overview: string | null;
	episodeNumber: number;
	seasonNumber: number;
	airDate: string | null;
	posterPath: string | null;
	name: string;
	stillPath: string | null;
	voteAverage: number | null;
	voteCount: number | null;
	runtime: number | null;
	guestStars: any[] | null;
	crew: any[] | null;
}

export interface TmdbTvSeason {
	id: number;
	posterPath: string | null;
	seasonNumber: number;
	episodeCount: number;
	airDate: string | null;
	name: string;
	overview: string | null;
	episodes?: TmdbTvEpisode[];
}

export interface TmdbTvDetails {
	tmdbId: number;
	name: string;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	firstAirDate: string | null;
	rating: number | null;
	episodeRuntime: number | null;
	seasonCount: number | null;
	episodeCount: number | null;
	status: string | null;
	originCountry: string[] | null;
	productionCompanies: { id: number; name: string; logoPath: string | null }[] | null;
	seasons: TmdbTvSeason[];
	imdbId?: string | null;
	cast?: any[] | null;
	trailerUrl?: string | null;
	genres?: { id: number; name: string }[] | null;
	found: boolean;
}
