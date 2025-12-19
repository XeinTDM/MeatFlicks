<script lang="ts">
	type SEOHeadProps = {
		title: string;
		description: string;
		canonical?: string;
		ogType?: 'website' | 'article' | 'video.movie' | 'video.tv_show';
		ogImage?: string;
		ogImageAlt?: string;
		twitterCard?: 'summary' | 'summary_large_image' | 'player';
		noindex?: boolean;
		nofollow?: boolean;
		keywords?: string[];
		author?: string;
		publishedTime?: string;
		modifiedTime?: string;
	};

	let {
		title,
		description,
		canonical,
		ogType = 'website',
		ogImage,
		ogImageAlt,
		twitterCard = 'summary_large_image',
		noindex = false,
		nofollow = false,
		keywords = [],
		author,
		publishedTime,
		modifiedTime
	}: SEOHeadProps = $props();

	const baseUrl = 'https://meatflicks.com';
	const siteName = 'MeatFlicks';
	const twitterHandle = '@meatflicks'; // Update with actual handle

	const fullTitle = $derived(title.includes('MeatFlicks') ? title : `${title} | ${siteName}`);
	const canonicalUrl = $derived(canonical ? `${baseUrl}${canonical}` : undefined);
	const robotsContent = $derived.by(() => {
		const directives = [];
		if (noindex) directives.push('noindex');
		if (nofollow) directives.push('nofollow');
		return directives.length > 0 ? directives.join(', ') : 'index, follow';
	});

	// Optimize Open Graph image
	const optimizedOgImage = $derived.by(() => {
		if (!ogImage) return `${baseUrl}/og-default.png`; // Fallback image

		// If it's a TMDB image, use optimized size
		if (ogImage.includes('image.tmdb.org')) {
			// Use w1280 for OG images (recommended size)
			return ogImage.replace(/w\d+/, 'w1280');
		}

		return ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`;
	});
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{fullTitle}</title>
	<meta name="title" content={fullTitle} />
	<meta name="description" content={description} />
	{#if keywords.length > 0}
		<meta name="keywords" content={keywords.join(', ')} />
	{/if}
	{#if author}
		<meta name="author" content={author} />
	{/if}
	<meta name="robots" content={robotsContent} />

	<!-- Canonical URL -->
	{#if canonicalUrl}
		<link rel="canonical" href={canonicalUrl} />
	{/if}

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content={ogType} />
	<meta property="og:site_name" content={siteName} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	{#if canonicalUrl}
		<meta property="og:url" content={canonicalUrl} />
	{/if}
	<meta property="og:image" content={optimizedOgImage} />
	{#if ogImageAlt}
		<meta property="og:image:alt" content={ogImageAlt} />
	{/if}
	<meta property="og:image:width" content="1280" />
	<meta property="og:image:height" content="720" />
	<meta property="og:locale" content="en_US" />

	<!-- Article specific (if applicable) -->
	{#if publishedTime && ogType === 'article'}
		<meta property="article:published_time" content={publishedTime} />
	{/if}
	{#if modifiedTime && ogType === 'article'}
		<meta property="article:modified_time" content={modifiedTime} />
	{/if}

	<!-- Twitter Card -->
	<meta name="twitter:card" content={twitterCard} />
	<meta name="twitter:site" content={twitterHandle} />
	<meta name="twitter:creator" content={twitterHandle} />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={optimizedOgImage} />
	{#if ogImageAlt}
		<meta name="twitter:image:alt" content={ogImageAlt} />
	{/if}

	<!-- Additional Meta Tags -->
	<meta name="format-detection" content="telephone=no" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>
