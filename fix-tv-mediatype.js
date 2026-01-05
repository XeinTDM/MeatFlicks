import { db } from './src/lib/server/db/index.js';
import { movies } from './src/lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

async function fixTvSeriesMediaType() {
    console.log('Updating Stranger Things mediaType to tv...');

    const result = await db
        .update(movies)
        .set({ mediaType: 'tv' })
        .where(eq(movies.imdbId, 'tt4574334'));

    console.log('Update complete!');

    // Verify the update
    const strangerThings = await db
        .select()
        .from(movies)
        .where(eq(movies.imdbId, 'tt4574334'))
        .limit(1);

    if (strangerThings.length > 0) {
        console.log('Stranger Things data:', {
            id: strangerThings[0].id,
            title: strangerThings[0].title,
            mediaType: strangerThings[0].mediaType,
            imdbId: strangerThings[0].imdbId,
            tmdbId: strangerThings[0].tmdbId
        });
    }

    process.exit(0);
}

fixTvSeriesMediaType().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
