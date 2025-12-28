export type MediaType = 'movie' | 'tv';

export interface StreamingProviderContext {
	mediaType: MediaType;
	tmdbId: number;
	imdbId?: string;
	season?: number;
	episode?: number;
	language?: string;
	preferredQuality?: string;
	preferredSubtitleLanguage?: string;
	includeQualities?: boolean;
	includeSubtitles?: boolean;
	startAt?: number;
	sub_file?: string;
	sub_label?: string;
}

export interface VideoQuality {
	label: string;
	resolution: string;
	bitrate?: number;
	url: string;
	isDefault?: boolean;
}

export interface SubtitleTrack {
	id: string;
	label: string;
	language: string;
	url: string;
	isDefault?: boolean;
}

export interface StreamingSource {
	providerId: string;
	streamUrl: string;
	embedUrl?: string;
	reliabilityScore: number;
	notes?: string;
	qualities?: VideoQuality[];
	subtitles?: SubtitleTrack[];
}

export interface StreamingProvider {
	id: string;
	label: string;
	priority: number;
	supportedMedia: MediaType[];
	fetchSource(context: StreamingProviderContext): Promise<StreamingSource | null>;
}
