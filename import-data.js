#!/usr/bin/env node

import { importTopRatedMovies, importTopRatedTvShows } from './src/lib/server/importer.ts';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
	try {
		switch (command) {
			case 'movies':
				console.log('Importing top-rated movies...');
				await importTopRatedMovies();
				console.log('Movies import completed successfully!');
				break;
			case 'tv':
			case 'tvshows':
				console.log('Importing top-rated TV shows...');
				await importTopRatedTvShows();
				console.log('TV shows import completed successfully!');
				break;
			case 'all':
				console.log('Importing both movies and TV shows...');
				console.log('Importing movies...');
				await importTopRatedMovies();
				console.log('Movies done. Importing TV shows...');
				await importTopRatedTvShows();
				console.log('All imports completed successfully!');
				break;
			default:
				console.log('Usage: bun run import-data [movies|tv|all]');
				console.log('  movies  - Import top-rated movies');
				console.log('  tv      - Import top-rated TV shows');
				console.log('  all     - Import both movies and TV shows');
				process.exit(1);
		}
	} catch (error) {
		console.error('Import failed:', error);
		process.exit(1);
	}
}

main();
