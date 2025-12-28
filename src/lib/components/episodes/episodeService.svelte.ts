import type { MediaType } from '$lib/streaming/streamingService.svelte';

export type Episode = {
    id: number;
    name: string;
    episodeNumber: number;
    seasonNumber: number;
    stillPath: string | null;
    runtime?: number | null;
};

export class EpisodeService {
    selectedSeason = $state<number>(1);
    selectedEpisode = $state<number>(1);
    episodesList = $state<Episode[]>([]);
    isLoadingEpisodes = $state(false);

    fetchEpisodes = async (tmdbId: number | null, seasonNumber: number) => {
        if (!tmdbId) return;

        this.isLoadingEpisodes = true;
        try {
            const response = await fetch(`/api/tv/${tmdbId}/season/${seasonNumber}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                this.episodesList = data.episodes || [];
            }
        } catch (error) {
            console.error('Failed to fetch episodes', error);
        } finally {
            this.isLoadingEpisodes = false;
        }
    };

    handleSeasonChange = (seasonNumber: number) => {
        this.selectedSeason = seasonNumber;
        this.selectedEpisode = 1;
        this.episodesList = [];
    };

    handleEpisodeSelect = (episodeNumber: number) => {
        this.selectedEpisode = episodeNumber;
    };

    getNextEpisodeLabel = (seasons: { id: number; name: string; seasonNumber: number; episodeCount: number; posterPath: string | null; }[] | undefined, mediaType: MediaType) => {
        if (!seasons || mediaType !== 'tv') return 'Next Episode';

        const currentSeasonData = seasons.find((s) => s.seasonNumber === this.selectedSeason);
        if (!currentSeasonData) return 'Next Episode';

        if (this.selectedEpisode < currentSeasonData.episodeCount) {
            return `S${this.selectedSeason}:E${this.selectedEpisode + 1}`;
        } else {
            const nextSeason = seasons.find((s) => s.seasonNumber === this.selectedSeason + 1);
            if (nextSeason) {
                return `S${nextSeason.seasonNumber}:E1`;
            }
        }
        return 'Next Episode';
    };
}
