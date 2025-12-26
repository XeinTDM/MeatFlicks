import type { MediaType } from '$lib/streaming/streamingService';

export type Episode = {
    id: number;
    name: string;
    episodeNumber: number;
    seasonNumber: number;
    stillPath: string | null;
};

export function createEpisodeService() {
    let selectedSeason = <number>1;
    let selectedEpisode = <number>1;
    let episodesList = <Episode[]>[];
    let isLoadingEpisodes = false;

    async function fetchEpisodes(tmdbId: number | null, seasonNumber: number) {
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
    }

    function handleSeasonChange(seasonNumber: number) {
        selectedSeason = seasonNumber;
        selectedEpisode = 1;
        episodesList = [];
    }

    function handleEpisodeSelect(episodeNumber: number) {
        selectedEpisode = episodeNumber;
    }

    function getNextEpisodeLabel(seasons: { id: number; name: string; seasonNumber: number; episodeCount: number; posterPath: string | null; }[] | undefined, mediaType: MediaType) {
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
    }

    return {
        get selectedSeason() {
            return selectedSeason;
        },
        get selectedEpisode() {
            return selectedEpisode;
        },
        get episodesList() {
            return episodesList;
        },
        get isLoadingEpisodes() {
            return isLoadingEpisodes;
        },
        fetchEpisodes,
        handleSeasonChange,
        handleEpisodeSelect,
        getNextEpisodeLabel
    };
}

export type EpisodeService = ReturnType<typeof createEpisodeService>;
