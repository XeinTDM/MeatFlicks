import type { GenreRecord, MovieRecord, MovieRow } from './types';

export const mapMovieRow = (row: MovieRow, genres: GenreRecord[] = []): MovieRecord => ({
	...row,
	genres
});

export const mapMovieRows = (
	rows: MovieRow[],
	genreLookup: Map<string, GenreRecord[]>
): MovieRecord[] => {
	return rows.map((row) => mapMovieRow(row, genreLookup.get(row.id) ?? []));
};
