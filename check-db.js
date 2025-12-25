import { db } from './src/lib/server/db/client';
import { movies, collections, genres, moviesGenres } from './src/lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

async function checkMovies() {
	try {
		console.log('=== Checking Movies in Database ===');
		const allMovies = await db.select().from(movies).limit(10);
		console.log('Total movies in DB:', allMovies.length);
		console.log(
			'Sample movies:',
			allMovies.map((m) => ({ id: m.id, tmdbId: m.tmdbId, imdbId: m.imdbId, title: m.title }))
		);

		console.log('\n=== Checking Collections ===');
		const allCollections = await db.select().from(collections).limit(10);
		console.log('Collections:', allCollections);

		console.log('\n=== Checking Genres ===');
		const allGenres = await db.select().from(genres).limit(10);
		console.log('Genres:', allGenres);

		console.log('\n=== Checking Movies in Collections ===');
		if (allCollections.length > 0) {
			const collectionMovies = await db
				.select({ movieId: movies.id, movieTitle: movies.title, collectionName: collections.name })
				.from(movies)
				.innerJoin(collections, eq(movies.collectionId, collections.id))
				.limit(10);
			console.log('Movies in collections:', collectionMovies);
		}

		console.log('\n=== Checking Movies in Genres ===');
		if (allGenres.length > 0) {
			const genreMovies = await db
				.select({ movieId: movies.id, movieTitle: movies.title, genreName: genres.name })
				.from(movies)
				.innerJoin(moviesGenres, eq(movies.id, moviesGenres.movieId))
				.innerJoin(genres, eq(moviesGenres.genreId, genres.id))
				.limit(10);
			console.log('Movies in genres:', genreMovies);
		}

		// Check specific IDs from the error
		console.log('\n=== Checking Specific IDs ===');
		const movie1 = await db
			.select()
			.from(movies)
			.where(eq(movies.id, '4021522c-b8f7-4d91-a7ec-2cc4a6d712ef'))
			.limit(1);
		console.log('Movie with UUID 4021522c-b8f7-4d91-a7ec-2cc4a6d712ef:', movie1);

		const movie2 = await db
			.select()
			.from(movies)
			.where(sql`${movies.imdbId} = 'tt0816692'`)
			.limit(1);
		console.log('Movie with IMDB ID tt0816692:', movie2);
	} catch (error) {
		console.error('Error:', error);
	} finally {
		process.exit(0);
	}
}

checkMovies();
