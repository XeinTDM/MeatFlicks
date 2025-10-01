import type { GenreRecord, MovieRecord, MovieRow } from "./types";

type Nullable<T> = T | null | undefined;

const toBoolean = (value: Nullable<number>): boolean => value === 1;

export const mapMovieRow = (row: MovieRow, genres: GenreRecord[] = []): MovieRecord => ({
	...row,
	genres,
	is4K: toBoolean(row.is4K),
	isHD: toBoolean(row.isHD)
});

export const mapMovieRows = (
	rows: MovieRow[],
	genreLookup: Map<string, GenreRecord[]>
): MovieRecord[] => {
	return rows.map((row) => mapMovieRow(row, genreLookup.get(row.id) ?? []));
};
