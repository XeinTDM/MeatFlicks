<script lang="ts">
	import type { MediaType } from '$lib/streaming/types';

	type StructuredDataProps = {
		media: {
			id: string;
			title: string;
			overview: string | null;
			posterPath: string | null;
			releaseDate: string | null;
			rating: number | null;
			durationMinutes: number | null;
			genres?: { id: number; name: string }[];
			cast?: { id: number; name: string; character: string }[];
			trailerUrl?: string | null;
			seasonCount?: number | null;
			episodeCount?: number | null;
			voteCount?: number | null;
		};
		mediaType: MediaType;
		canonicalUrl?: string;
	};

	let { media, mediaType, canonicalUrl }: StructuredDataProps = $props();

	const structuredData = $derived.by(() => {
		const baseUrl = 'https://meatflicks.com';
		const url = canonicalUrl || `${baseUrl}/${mediaType}/${media.id}`;

		const imageUrl = media.posterPath?.startsWith('http')
			? media.posterPath
			: media.posterPath
				? `https://image.tmdb.org/t/p/w780${media.posterPath}`
				: null;

		const aggregateRating = media.rating
			? {
					'@type': 'AggregateRating',
					ratingValue: media.rating.toFixed(1),
					bestRating: '10',
					worstRating: '0',
					ratingCount: media.voteCount || 1
				}
			: null;

		const actors = media.cast?.slice(0, 10).map((member) => ({
			'@type': 'Person',
			name: member.name,
			url: `${baseUrl}/person/${member.id}`
		}));

		if (mediaType === 'movie') {
			const movieData: Record<string, unknown> = {
				'@context': 'https://schema.org',
				'@type': 'Movie',
				name: media.title,
				url: url,
				description: media.overview || `Watch ${media.title} on MeatFlicks`,
				datePublished: media.releaseDate || undefined,
				genre: media.genres?.map((g) => g.name) || []
			};

			if (imageUrl) {
				movieData.image = imageUrl;
			}

			if (aggregateRating) {
				movieData.aggregateRating = aggregateRating;
			}

			if (actors && actors.length > 0) {
				movieData.actor = actors;
			}

			if (media.durationMinutes) {
				movieData.duration = `PT${media.durationMinutes}M`;
			}

			if (media.trailerUrl) {
				// Convert watch URL to embed URL for schema
				let embedUrl = media.trailerUrl;
				if (media.trailerUrl.includes('youtube.com/watch?v=')) {
					embedUrl = media.trailerUrl.replace('watch?v=', 'embed/');
				}

				movieData.trailer = {
					'@type': 'VideoObject',
					name: `${media.title} Trailer`,
					embedUrl: embedUrl,
					thumbnailUrl: imageUrl || undefined,
					uploadDate: media.releaseDate || undefined
				};
			}
			return movieData;
		} else {
			const tvData: Record<string, unknown> = {
				'@context': 'https://schema.org',
				'@type': 'TVSeries',
				name: media.title,
				url: url,
				description: media.overview || `Watch ${media.title} on MeatFlicks`,
				datePublished: media.releaseDate || undefined,
				genre: media.genres?.map((g) => g.name) || []
			};

			if (imageUrl) {
				tvData.image = imageUrl;
			}

			if (aggregateRating) {
				tvData.aggregateRating = aggregateRating;
			}

			if (actors && actors.length > 0) {
				tvData.actor = actors;
			}

			if (media.seasonCount) {
				tvData.numberOfSeasons = media.seasonCount;
			}

			if (media.episodeCount) {
				tvData.numberOfEpisodes = media.episodeCount;
			}

			if (media.trailerUrl) {
				// Convert watch URL to embed URL for schema
				let embedUrl = media.trailerUrl;
				if (media.trailerUrl.includes('youtube.com/watch?v=')) {
					embedUrl = media.trailerUrl.replace('watch?v=', 'embed/');
				}

				tvData.trailer = {
					'@type': 'VideoObject',
					name: `${media.title} Trailer`,
					embedUrl: embedUrl,
					thumbnailUrl: imageUrl || undefined,
					uploadDate: media.releaseDate || undefined
				};
			}

			return tvData;
		}
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html '<script type="application/ld+json">' + JSON.stringify(structuredData) + '</script>'}
</svelte:head>
