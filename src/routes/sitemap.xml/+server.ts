import { db } from '$lib/server/db';
import { movies } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const prerender = true;

const website = 'https://meatflicks.com';

// Static pages with their priorities
const staticPages = [
	{ url: '', changefreq: 'daily', priority: '1.0' },
	{ url: '/explore', changefreq: 'daily', priority: '0.9' },
	{ url: '/explore/movies', changefreq: 'daily', priority: '0.9' },
	{ url: '/explore/tv-shows', changefreq: 'daily', priority: '0.9' },
	{ url: '/explore/anime', changefreq: 'weekly', priority: '0.8' },
	{ url: '/explore/manga', changefreq: 'weekly', priority: '0.8' },
	{ url: '/search', changefreq: 'weekly', priority: '0.8' },
	{ url: '/watchlist', changefreq: 'weekly', priority: '0.7' },
	{ url: '/history', changefreq: 'weekly', priority: '0.7' }
];

export async function GET() {
	try {
		// Fetch recent movies from database
		const recentMovies = await db
			.select({
				id: movies.id,
				updatedAt: movies.updatedAt
			})
			.from(movies)
			.orderBy(desc(movies.updatedAt))
			.limit(1000); // Limit to prevent sitemap from being too large

		const movieEntries = recentMovies
			.map((movie) => {
				const lastmod = movie.updatedAt ? new Date(movie.updatedAt).toISOString() : undefined;

				return `
  <url>
    <loc>${website}/movie/${movie.id}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
			})
			.join('');

		// Note: TV shows are fetched dynamically from TMDB API and not stored in database
		// They are accessible via /tv/[tmdbId] but cannot be included in static sitemap
		// TV show URLs are generated on-demand when accessed

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
  ${movieEntries}
</urlset>`;

		return new Response(body, {
			headers: {
				'Cache-Control': 'max-age=0, s-maxage=3600',
				'Content-Type': 'application/xml'
			}
		});
	} catch (error) {
		console.error('Error generating sitemap:', error);

		// Fallback to static sitemap if database query fails
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
