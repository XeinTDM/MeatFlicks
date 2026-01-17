import { db } from '$lib/server/db';
import { media } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

// We want this to be dynamic since our media library grows
export const prerender = false;

const website = 'https://meatflicks.com';

const staticPages = [
	{ url: '/', changefreq: 'daily', priority: '1.0' },
	{ url: '/explore', changefreq: 'daily', priority: '0.9' },
	{ url: '/search', changefreq: 'weekly', priority: '0.8' }
];

export async function GET() {
	try {
		// Fetch 5000 most recently updated media items
		const recentMedia = await db
			.select({
				id: media.id,
				tmdbId: media.tmdbId,
				mediaType: media.mediaType,
				updatedAt: media.updatedAt
			})
			.from(media)
			.orderBy(desc(media.updatedAt))
			.limit(5000);

		const mediaEntries = recentMedia
			.map((item) => {
				const lastmod = item.updatedAt ? new Date(item.updatedAt).toISOString() : undefined;
				
				// Determine the correct route based on media type
				let typePath = 'movie';
				if (item.mediaType === 'tv') typePath = 'tv';
				else if (item.mediaType === 'anime') typePath = 'tv'; // Anime series use /tv/ usually, or we can check actual routing

				const identifier = item.tmdbId || item.id;
				const loc = `${website}/${typePath}/${identifier}`;

				return `
  <url>
    <loc>${loc}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
			})
			.join('');

		const staticEntries = staticPages
			.map(
				(page) => `
  <url>
    <loc>${website}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
			)
			.join('');

		const body = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
>
  ${staticEntries}
  ${mediaEntries}
</urlset>`;

		return new Response(body, {
			headers: {
				'Cache-Control': 'max-age=0, s-maxage=3600',
				'Content-Type': 'application/xml'
			}
		});
	} catch (error) {
		console.error('Error generating sitemap:', error);

		const fallbackBody = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
		.map(
			(page) => `
  <url>
    <loc>${website}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
		)
		.join('')}
</urlset>`;

		return new Response(fallbackBody, {
			headers: {
				'Cache-Control': 'max-age=0, s-maxage=3600',
				'Content-Type': 'application/xml'
			}
		});
	}
}