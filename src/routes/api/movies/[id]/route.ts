import { json, type RequestHandler } from '@sveltejs/kit';
import type { Prisma } from '@prisma/client';
import prisma from '$lib/server/db';
import {
	fetchTmdbMovieDetails,
	fetchTmdbMovieExtras,
	lookupTmdbIdByImdbId
} from '$lib/server/services/tmdb.service';

async function resolveMovieByIdentifier(identifier: string, queryMode: 'id' | 'tmdb' | 'imdb') {
	switch (queryMode) {
		case 'tmdb': {
			const tmdbId = Number.parseInt(identifier, 10);
			if (!Number.isFinite(tmdbId)) {
				throw new Error('Invalid TMDB id provided.');
			}

			const movie = await prisma.movie.findUnique({
				where: { tmdbId },
				include: { genres: true }
			});

			return { movie, tmdbId } as const;
		}
		case 'imdb': {
			const tmdbId = await lookupTmdbIdByImdbId(identifier);
			if (!tmdbId) {
				return { movie: null, tmdbId: null } as const;
			}

			const movie = await prisma.movie.findUnique({
				where: { tmdbId },
				include: { genres: true }
			});

			return { movie, tmdbId } as const;
		}
		case 'id':
		default: {
			const movie = await prisma.movie.findUnique({
				where: { id: identifier },
				include: { genres: true }
			});

			return { movie, tmdbId: movie?.tmdbId ?? null } as const;
		}
	}
}

function isValidTmdbId(value: number | null | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

type MovieWithDetails = Prisma.MovieGetPayload<{
	include: {
		genres: true;
	};
}> & {
	imdbId: string | null;
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
};

async function resolveFallbackMovie(tmdbId: number): Promise<MovieWithDetails | null> {
	if (!isValidTmdbId(tmdbId)) {
		return null;
	}

	const details = await fetchTmdbMovieDetails(tmdbId);

	if (!details.found) {
		return null;
	}

	const releaseDate = details.releaseDate ? new Date(details.releaseDate) : null;
	const rating = details.rating ?? null;
	const durationMinutes = details.runtime ?? null;
	const uniqueGenreNames = Array.from(
		new Set(
			details.genres
				.map((genre) => (typeof genre.name === 'string' ? genre.name.trim() : ''))
				.filter((name) => Boolean(name))
		)
	);

	const movie = await prisma.$transaction(async (tx) => {
		const genreRecords = await Promise.all(
			uniqueGenreNames.map((name) =>
				tx.genre.upsert({ where: { name }, update: {}, create: { name } })
			)
		);

		const genreConnections = genreRecords.map((genre) => ({ id: genre.id }));

		return tx.movie.upsert({
			where: { tmdbId },
			update: {
				title: details.title ?? 'Untitled',
				overview: details.overview ?? null,
				posterPath: details.posterPath ?? null,
				backdropPath: details.backdropPath ?? null,
				releaseDate: releaseDate ?? null,
				rating,
				durationMinutes,
				genres: { set: genreConnections }
			},
			create: {
				tmdbId,
				title: details.title ?? 'Untitled',
				overview: details.overview ?? null,
				posterPath: details.posterPath ?? null,
				backdropPath: details.backdropPath ?? null,
				releaseDate: releaseDate ?? undefined,
				rating: rating ?? undefined,
				durationMinutes: durationMinutes ?? undefined,
				is4K: false,
				isHD: true,
				...(genreConnections.length > 0 ? { genres: { connect: genreConnections } } : {})
			},
			include: { genres: true }
		});
	});

	return {
		...movie,
		imdbId: details.imdbId,
		cast: details.cast,
		trailerUrl: details.trailerUrl
	};
}

export const GET: RequestHandler = async ({ params, url }) => {
	const movieIdentifier = params.id;
	const queryModeParam = url.searchParams.get('by');
	const queryMode = queryModeParam === 'tmdb' || queryModeParam === 'imdb' ? queryModeParam : 'id';

	if (!movieIdentifier) {
		return json({ error: 'Movie identifier is required.' }, { status: 400 });
	}

	try {
		const { movie, tmdbId } = await resolveMovieByIdentifier(movieIdentifier, queryMode);
		const effectiveTmdbId = isValidTmdbId(tmdbId)
			? tmdbId
			: queryMode === 'tmdb'
				? Number.parseInt(movieIdentifier, 10)
				: null;

		if (!movie || !isValidTmdbId(effectiveTmdbId)) {
			const fallbackMovie = isValidTmdbId(effectiveTmdbId)
				? await resolveFallbackMovie(effectiveTmdbId)
				: null;

			if (!fallbackMovie) {
				return json({ message: 'Movie not found' }, { status: 404 });
			}

			return json(fallbackMovie);
		}

		const extras = await fetchTmdbMovieExtras(effectiveTmdbId);

		const payload = {
			...movie,
			releaseDate: movie.releaseDate ?? (extras.releaseDate ? new Date(extras.releaseDate) : null),
			durationMinutes: movie.durationMinutes ?? extras.runtime ?? null,
			imdbId: extras.imdbId,
			cast: extras.cast,
			trailerUrl: extras.trailerUrl
		};

		return json(payload);
	} catch (error) {
		console.error(`Error fetching movie with identifier ${movieIdentifier}:`, error);
		return json(
			{ error: `Failed to fetch movie with identifier ${movieIdentifier}` },
			{ status: 500 }
		);
	}
};
