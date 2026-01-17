import { db } from './client';
import { mediaGenres, genres } from './schema';
import { inArray } from 'drizzle-orm';
import { mapMediaRows } from './mappers';
import type { 
	GenreRecord, 
	MediaRecord, 
	MediaRow, 
	MediaSummary,
	MovieRecord,
	MovieRow,
	MovieSummary
} from './types';

let globalGenreCache: Map<number, GenreRecord> | null = null;
let globalGenreNameMap: Map<string, number> | null = null;

export const getGenreCache = async () => {
	if (globalGenreCache) return globalGenreCache;
	const rows = await db.select().from(genres);
	globalGenreCache = new Map(rows.map((r) => [r.id, r]));
	globalGenreNameMap = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
	return globalGenreCache;
};

export const getGenreNameMap = async () => {
	if (globalGenreNameMap) return globalGenreNameMap;
	await getGenreCache();
	return globalGenreNameMap!;
};

export const invalidateGenreCache = () => {
	globalGenreCache = null;
	globalGenreNameMap = null;
};

export const fetchGenresForMedia = async (ids: string[]): Promise<Map<string, GenreRecord[]>> => {
	const lookup = new Map<string, GenreRecord[]>();

	if (ids.length === 0) {
		return lookup;
	}

	const [rows, genreCache] = await Promise.all([
		db
			.select({
				mediaId: mediaGenres.mediaId,
				genreId: mediaGenres.genreId
			})
			.from(mediaGenres)
			.where(inArray(mediaGenres.mediaId, ids)),
		getGenreCache()
	]);

	for (const row of rows) {
		const genre = genreCache.get(row.genreId);
		if (!genre) continue;

		if (!lookup.has(row.mediaId)) {
			lookup.set(row.mediaId, []);
		}
		lookup.get(row.mediaId)!.push(genre);
	}

	for (const genreList of lookup.values()) {
		genreList.sort((a, b) => a.name.localeCompare(b.name));
	}

	return lookup;
};

export const mapRowsToRecords = async (rows: MediaRow[]): Promise<MediaRecord[]> => {
	if (rows.length === 0) {
		return [];
	}

	const ids = rows.map((row) => row.id);
	const genresLookup = await fetchGenresForMedia(ids);
	return mapMediaRows(rows, genresLookup);
};

export const toMediaSummary = (media: MediaRecord): MediaSummary => {
	const { ...rest } = media;
	return rest;
};

export const mapRowsToSummaries = async (rows: MediaRow[]): Promise<MediaSummary[]> => {
	const records = await mapRowsToRecords(rows);
	return records.map(toMediaSummary);
};

// Compatibility aliases
export const fetchGenresForMovies = fetchGenresForMedia;
export const toMovieSummary = toMediaSummary;

export const MEDIA_COLUMNS = '*';
export const MOVIE_COLUMNS = MEDIA_COLUMNS;
export const MOVIE_ORDER_BY = '';