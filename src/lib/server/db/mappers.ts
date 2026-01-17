import type { GenreRecord, MediaRecord, MediaRow } from './types';

export const mapMediaRow = (row: MediaRow, genres: GenreRecord[] = []): MediaRecord => ({
	...row,
	genres
});

export const mapMediaRows = (
	rows: MediaRow[],
	genreLookup: Map<string, GenreRecord[]>
): MediaRecord[] => {
	return rows.map((row) => mapMediaRow(row, genreLookup.get(row.id) ?? []));
};

// Compatibility aliases
export const mapMovieRow = mapMediaRow;
export const mapMovieRows = mapMediaRows;