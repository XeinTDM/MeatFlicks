import { describe, it, expect } from 'vitest';
import {
	extractQualities,
	extractSubtitles,
	getBestQualityUrl,
	getSubtitleTrack
} from './quality-helpers';

describe('quality-helpers', () => {
	describe('extractQualities', () => {
		it('should extract and sort qualities correctly', () => {
			const sources = [
				{ url: 'url1', quality: '720p' },
				{ url: 'url2', quality: '1080p' },
				{ url: 'url3', resolution: '4k' },
				{ url: 'url4', label: 'SD', resolution: '480p' }
			];

			const result = extractQualities(sources);

			expect(result).toHaveLength(4);
			expect(result[0].resolution).toBe('4k');
			expect(result[1].resolution).toBe('1080p');
			expect(result[2].resolution).toBe('720p');
			expect(result[3].resolution).toBe('480p');
		});

		it('should handle fallback URL', () => {
			const result = extractQualities([], 'fallback-url');
			expect(result).toHaveLength(1);
			expect(result[0].url).toBe('fallback-url');
			expect(result[0].label).toBe('Auto');
		});

		it('should identify default qualities', () => {
			const sources = [
				{ url: 'url1', quality: '1080p' },
				{ url: 'url2', quality: '360p' }
			];
			const result = extractQualities(sources);
			expect(result.find((q) => q.resolution === '1080p')?.isDefault).toBe(true);
			expect(result.find((q) => q.resolution === '360p')?.isDefault).toBe(false);
		});
	});

	describe('extractSubtitles', () => {
		it('should extract and sort subtitles correctly', () => {
			const sources = [
				{ url: 'url1', language: 'fr' },
				{ url: 'url2', language: 'en' },
				{ url: 'url3', language: 'es' }
			];

			const result = extractSubtitles(sources);

			expect(result).toHaveLength(3);
			expect(result[0].language).toBe('en'); // Default/English first
			expect(result[0].label).toBe('English');
		});

		it('should handle unknown languages', () => {
			const sources = [{ url: 'url1', language: 'xx' }];
			const result = extractSubtitles(sources);
			expect(result[0].label).toBe('XX');
		});
	});

	describe('getBestQualityUrl', () => {
		const qualities = [
			{ label: '4K', resolution: '4k', url: 'url4k', isDefault: false },
			{ label: '1080p', resolution: '1080p', url: 'url1080', isDefault: true },
			{ label: '720p', resolution: '720p', url: 'url720', isDefault: false }
		];

		it('should return default quality if no preference', () => {
			expect(getBestQualityUrl(qualities)).toBe('url1080');
		});

		it('should return preferred quality if available', () => {
			expect(getBestQualityUrl(qualities, '4K')).toBe('url4k');
			expect(getBestQualityUrl(qualities, '720')).toBe('url720');
		});

		it('should fallback to best available if preferred not found', () => {
			expect(getBestQualityUrl(qualities, '1440p')).toBe('url4k'); // Highest available
		});
	});

	describe('getSubtitleTrack', () => {
		const subtitles = [
			{ id: 'en', label: 'English', language: 'en', url: 'urlEn', isDefault: true },
			{ id: 'fr', label: 'French', language: 'fr', url: 'urlFr', isDefault: false }
		];

		it('should return default track if no preference', () => {
			expect(getSubtitleTrack(subtitles)).toEqual(subtitles[0]);
		});

		it('should return preferred language', () => {
			expect(getSubtitleTrack(subtitles, 'fr')).toEqual(subtitles[1]);
		});

		it('should fallback to English if preferred not found', () => {
			expect(getSubtitleTrack(subtitles, 'de')).toEqual(subtitles[0]);
		});
	});
});
