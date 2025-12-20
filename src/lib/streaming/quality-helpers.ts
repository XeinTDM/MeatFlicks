import type { VideoQuality, SubtitleTrack } from './types';

export interface QualitySource {
	url: string;
	quality?: string;
	label?: string;
	resolution?: string;
	bitrate?: number;
}

export interface SubtitleSource {
	url: string;
	language: string;
	label?: string;
}

/**
 * Extract video quality information from various provider response formats
 */
export function extractQualities(sources: QualitySource[], fallbackUrl?: string): VideoQuality[] {
	const qualities: VideoQuality[] = [];
	
	for (const source of sources) {
		const quality = source.quality || source.label || source.resolution || 'Unknown';
		const resolution = source.resolution || parseResolutionFromLabel(quality);
		const label = source.label || formatQualityLabel(quality, resolution);
		
		qualities.push({
			label,
			resolution,
			bitrate: source.bitrate,
			url: source.url,
			isDefault: isDefaultQuality(quality)
		});
	}

	if (qualities.length === 0 && fallbackUrl) {
		qualities.push({
			label: 'Auto',
			resolution: 'Auto',
			url: fallbackUrl,
			isDefault: true
		});
	}

	return qualities.sort((a, b) => {
		const priorityOrder = ['4K', '1080p', '720p', '480p', '360p', 'Auto'];
		const aIndex = priorityOrder.findIndex(q => a.resolution.includes(q));
		const bIndex = priorityOrder.findIndex(q => b.resolution.includes(q));
		return aIndex - bIndex;
	});
}

/**
 * Extract subtitle information from various provider response formats
 */
export function extractSubtitles(sources: SubtitleSource[]): SubtitleTrack[] {
	const tracks: SubtitleTrack[] = [];
	
	for (const source of sources) {
		const language = source.language || 'unknown';
		const label = source.label || formatLanguageLabel(language);
		
		tracks.push({
			id: `${language}_${tracks.length}`,
			label,
			language,
			url: source.url,
			isDefault: isDefaultSubtitle(language)
		});
	}

	return tracks.sort((a, b) => {
		if (a.isDefault && !b.isDefault) return -1;
		if (!a.isDefault && b.isDefault) return 1;
		if (a.language === 'en' && b.language !== 'en') return -1;
		if (a.language !== 'en' && b.language === 'en') return 1;
		return a.label.localeCompare(b.label);
	});
}

/**
 * Parse resolution from quality label string
 */
function parseResolutionFromLabel(label: string): string {
	const resolutionPatterns = [
		/(\d{3,4})p/i,
		/(\d{3,4})x(\d{3,4})/i,
		/(4K|UHD)/i,
		/(HD|SD)/i
	];

	for (const pattern of resolutionPatterns) {
		const match = label.match(pattern);
		if (match) {
			if (match[1] && match[2]) {
				return `${match[1]}x${match[2]}`;
			}
			return match[0].toUpperCase();
		}
	}

	return label;
}

/**
 * Format quality label for display
 */
function formatQualityLabel(quality: string, resolution: string): string {
	if (quality.toLowerCase().includes('auto')) return 'Auto';
	if (resolution.includes('4K') || resolution.includes('UHD')) return '4K Ultra HD';
	if (resolution.includes('1080')) return '1080p Full HD';
	if (resolution.includes('720')) return '720p HD';
	if (resolution.includes('480')) return '480p SD';
	if (resolution.includes('360')) return '360p';
	return quality;
}

/**
 * Determine if this should be the default quality
 */
function isDefaultQuality(quality: string): boolean {
	const label = quality.toLowerCase();
	return label.includes('auto') || label.includes('1080') || label.includes('720');
}

/**
 * Determine if this should be the default subtitle
 */
function isDefaultSubtitle(language: string): boolean {
	return language === 'en' || language === 'eng';
}

/**
 * Format language label for display
 */
function formatLanguageLabel(language: string): string {
	const languageMap: Record<string, string> = {
		'en': 'English',
		'eng': 'English',
		'es': 'Español',
		'spa': 'Español',
		'fr': 'Français',
		'fra': 'Français',
		'de': 'Deutsch',
		'ger': 'Deutsch',
		'it': 'Italiano',
		'ita': 'Italiano',
		'pt': 'Português',
		'por': 'Português',
		'ru': 'Русский',
		'rus': 'Русский',
		'ja': '日本語',
		'jpn': '日本語',
		'ko': '한국어',
		'kor': '한국어',
		'zh': '中文',
		'chi': '中文',
		'ar': 'العربية',
		'ara': 'العربية',
		'hi': 'हिन्दी',
		'hin': 'हिन्दी'
	};

	return languageMap[language.toLowerCase()] || language.toUpperCase();
}

/**
 * Get the best quality URL based on preference
 */
export function getBestQualityUrl(
	qualities: VideoQuality[],
	preferredQuality?: string
): string | null {
	if (!qualities.length) return null;

	if (!preferredQuality) {
		const defaultQuality = qualities.find(q => q.isDefault);
		return defaultQuality?.url || qualities[0].url;
	}

	const exactMatch = qualities.find(q =>
		q.label.toLowerCase().includes(preferredQuality.toLowerCase()) ||
		q.resolution.toLowerCase().includes(preferredQuality.toLowerCase())
	);
	if (exactMatch) return exactMatch.url;

	const qualityHierarchy = ['4K', '1080p', '720p', '480p', '360p'];
	const targetIndex = qualityHierarchy.findIndex(q =>
		preferredQuality.toLowerCase().includes(q.toLowerCase())
	);

	if (targetIndex !== -1) {
		for (let i = targetIndex; i >= 0; i--) {
			const match = qualities.find(q =>
				q.resolution.toLowerCase().includes(qualityHierarchy[i].toLowerCase())
			);
			if (match) return match.url;
		}
		for (let i = targetIndex + 1; i < qualityHierarchy.length; i++) {
			const match = qualities.find(q =>
				q.resolution.toLowerCase().includes(qualityHierarchy[i].toLowerCase())
			);
			if (match) return match.url;
		}
	}

	return qualities[0].url;
}

/**
 * Get subtitle track by language preference
 */
export function getSubtitleTrack(
	subtitles: SubtitleTrack[],
	preferredLanguage?: string
): SubtitleTrack | null {
	if (!subtitles.length) return null;

	if (!preferredLanguage) {
		const defaultTrack = subtitles.find(s => s.isDefault);
		return defaultTrack || subtitles[0];
	}

	const exactMatch = subtitles.find(s =>
		s.language === preferredLanguage ||
		s.label.toLowerCase().includes(preferredLanguage.toLowerCase())
	);
	if (exactMatch) return exactMatch;

	const englishTrack = subtitles.find(s =>
		s.language === 'en' || s.language === 'eng' || s.label.toLowerCase().includes('english')
	);
	if (englishTrack) return englishTrack;

	return subtitles[0];
}
