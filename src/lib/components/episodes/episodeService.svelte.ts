import type { MediaType } from '$lib/streaming/types';

export type Episode = {
	id: number;
	name: string;
	episodeNumber: number;
	seasonNumber: number;
	stillPath: string | null;
	runtime?: number | null;
};

export type Season = {
	id: number;
	name: string;
	seasonNumber: number;
	episodeCount: number;
	posterPath: string | null;
};

export type EpisodeService = {
	episodesList: Episode[];
	isLoadingEpisodes: boolean;
	fetchEpisodes: (tmdbId: number | null, seasonNumber: number) => Promise<void>;
	getNextEpisodeLabel: (seasons: Season[] | undefined, mediaType: MediaType, selectedSeason: number, selectedEpisode: number) => string;
	getNextEpisode: (seasons: Season[] | undefined, selectedSeason: number, selectedEpisode: number) => { season: number; episode: number } | null;
};

export function createEpisodeService(): EpisodeService {
	let selectedSeason = $state(1);
	let selectedEpisode = $state(1);
	let episodesList = $state<Episode[]>([]);
	let isLoadingEpisodes = $state(false);

	return {
		get episodesList() {
			return episodesList;
		},
		set episodesList(value: Episode[]) {
			episodesList = value;
		},
		get isLoadingEpisodes() {
			return isLoadingEpisodes;
		},
		set isLoadingEpisodes(value: boolean) {
			isLoadingEpisodes = value;
		},
		fetchEpisodes: async (tmdbId: number | null, seasonNumber: number) => {
			if (!tmdbId) return;

			isLoadingEpisodes = true;
			try {
				const response = await fetch(`/api/tv/${tmdbId}/season/${seasonNumber}`, {
					credentials: 'include'
				});
				if (response.ok) {
					const data = await response.json();
					episodesList = data.episodes || [];
				}
			} catch (error) {
				console.error('Failed to fetch episodes', error);
			} finally {
				isLoadingEpisodes = false;
			}
		},
		getNextEpisodeLabel: (seasons: Season[] | undefined, mediaType: MediaType, selectedSeason: number, selectedEpisode: number) => {
			if (!seasons || mediaType !== 'tv') return 'Next Episode';

			const currentSeasonData = seasons.find((s) => s.seasonNumber === selectedSeason);
			if (!currentSeasonData) return 'Next Episode';

			if (selectedEpisode < currentSeasonData.episodeCount) {
				return `S${selectedSeason}:E${selectedEpisode + 1}`;
			} else {
				const nextSeason = seasons.find((s) => s.seasonNumber === selectedSeason + 1);
				if (nextSeason) {
					return `S${nextSeason.seasonNumber}:E1`;
				}
			}
			return 'Next Episode';
		},
		getNextEpisode: (seasons: Season[] | undefined, selectedSeason: number, selectedEpisode: number): { season: number; episode: number } | null => {
			if (!seasons) return null;

			const currentSeasonData = seasons.find((s) => s.seasonNumber === selectedSeason);
			if (!currentSeasonData) return null;

			if (selectedEpisode < currentSeasonData.episodeCount) {
				return { season: selectedSeason, episode: selectedEpisode + 1 };
			} else {
				const nextSeason = seasons.find((s) => s.seasonNumber === selectedSeason + 1);
				if (nextSeason) {
					return { season: nextSeason.seasonNumber, episode: 1 };
				}
			}
			return null;
		}
	};
}
