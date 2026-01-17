import { db } from './src/lib/server/db/client';
import { movies } from './src/lib/server/db/schema';

async function checkMediaTypes() {
	const allMovies = await db.select().from(movies);
	console.log(`Total movies: ${allMovies.length}`);
	for (const m of allMovies) {
		console.log(`ID: ${m.id}, Title: ${m.title}, MediaType: ${m.mediaType}, Rating: ${m.rating}`);
	}
}

checkMediaTypes();
