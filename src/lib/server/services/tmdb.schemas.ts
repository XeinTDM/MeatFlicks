import { z } from 'zod';

export const TmdbGenreSchema = z.object({
	id: z.number(),
	name: z.string()
});

export const TmdbCastMemberSchema = z.object({
	id: z.number(),
	name: z.string(),
	character: z.string()
});

export const TmdbVideoSchema = z.object({
	id: z.string(),
	key: z.string(),
	site: z.string(),
	type: z.string(),
	official: z.boolean()
});

export const TmdbProductionCompanySchema = z.object({
	id: z.number(),
	name: z.string(),
	logo_path: z.string().nullable().optional(),
	origin_country: z.string().optional()
});

export const TmdbProductionCountrySchema = z.object({
	iso_3166_1: z.string(),
	name: z.string()
});

export const TmdbMovieSchema = z.object({
	id: z.number(),
	imdb_id: z.string().nullable().optional(),
	title: z.string().optional(),
	original_title: z.string().optional(),
	overview: z.string().nullable().optional(),
	poster_path: z.string().nullable().optional(),
	backdrop_path: z.string().nullable().optional(),
	vote_average: z.number().nullable().optional(),
	release_date: z.string().nullable().optional(),
	runtime: z.number().nullable().optional(),
	genres: z.array(TmdbGenreSchema).optional(),
	credits: z
		.object({
			cast: z.array(TmdbCastMemberSchema)
		})
		.optional(),
	videos: z
		.object({
			results: z.array(TmdbVideoSchema)
		})
		.optional(),
	production_companies: z.array(TmdbProductionCompanySchema).optional(),
	production_countries: z.array(TmdbProductionCountrySchema).optional()
});

export const TmdbTvEpisodeSchema = z.object({
	id: z.number(),
	name: z.string(),
	overview: z.string().nullable().optional(),
	episode_number: z.number(),
	season_number: z.number(),
	air_date: z.string().nullable().optional(),
	still_path: z.string().nullable().optional(),
	vote_average: z.number().nullable().optional()
});

export const TmdbTvSeasonSchema = z.object({
	id: z.number(),
	name: z.string(),
	overview: z.string().nullable().optional(),
	poster_path: z.string().nullable().optional(),
	season_number: z.number(),
	episode_count: z.number().optional(),
	air_date: z.string().nullable().optional(),
	episodes: z.array(TmdbTvEpisodeSchema).optional()
});

export const TmdbTvSchema = z.object({
	id: z.number(),
	name: z.string().optional(),
	original_name: z.string().optional(),
	overview: z.string().nullable().optional(),
	poster_path: z.string().nullable().optional(),
	backdrop_path: z.string().nullable().optional(),
	vote_average: z.number().nullable().optional(),
	first_air_date: z.string().nullable().optional(),
	episode_run_time: z.array(z.number()).optional(),
	number_of_seasons: z.number().nullable().optional(),
	number_of_episodes: z.number().nullable().optional(),
	seasons: z.array(TmdbTvSeasonSchema).optional(),
	genres: z.array(TmdbGenreSchema).optional(),
	external_ids: z
		.object({
			imdb_id: z.string().nullable().optional()
		})
		.optional(),
	credits: z
		.object({
			cast: z.array(TmdbCastMemberSchema)
		})
		.optional(),
	videos: z
		.object({
			results: z.array(TmdbVideoSchema)
		})
		.optional(),
	production_companies: z.array(TmdbProductionCompanySchema).optional(),
	origin_country: z.array(z.string()).optional()
});

export const TmdbTrendingResultSchema = z.object({
	id: z.number()
});

export const TmdbTrendingResponseSchema = z.object({
	results: z.array(TmdbTrendingResultSchema)
});

export const TmdbFindResponseSchema = z.object({
	movie_results: z.array(z.object({ id: z.number() })),
	tv_results: z.array(z.object({ id: z.number() }))
});

export const TmdbRecommendationResultSchema = z.object({
	id: z.number(),
	title: z.string().optional(),
	name: z.string().optional(),
	poster_path: z.string().nullable().optional(),
	backdrop_path: z.string().nullable().optional(),
	vote_average: z.number().nullable().optional(),
	release_date: z.string().nullable().optional(),
	first_air_date: z.string().nullable().optional(),
	media_type: z.string().optional()
});

export const TmdbRecommendationResponseSchema = z.object({
	results: z.array(TmdbRecommendationResultSchema)
});

export const TmdbPersonCreditsSchema = z.object({
	cast: z
		.array(
			z.object({
				id: z.number(),
				title: z.string().optional(),
				name: z.string().optional(),
				character: z.string().optional(),
				poster_path: z.string().nullable().optional(),
				backdrop_path: z.string().nullable().optional(),
				media_type: z.string().optional(),
				release_date: z.string().nullable().optional(),
				first_air_date: z.string().nullable().optional(),
				vote_average: z.number().nullable().optional(),
				episode_count: z.number().optional()
			})
		)
		.optional(),
	crew: z
		.array(
			z.object({
				id: z.number(),
				title: z.string().optional(),
				name: z.string().optional(),
				department: z.string().optional(),
				job: z.string().optional(),
				media_type: z.string().optional(),
				poster_path: z.string().nullable().optional()
			})
		)
		.optional()
});

export const TmdbPersonSchema = z.object({
	id: z.number(),
	name: z.string(),
	biography: z.string().optional(),
	birthday: z.string().nullable().optional(),
	deathday: z.string().nullable().optional(),
	place_of_birth: z.string().nullable().optional(),
	profile_path: z.string().nullable().optional(),
	combined_credits: TmdbPersonCreditsSchema.optional(),
	images: z
		.object({
			profiles: z
				.array(
					z.object({
						file_path: z.string()
					})
				)
				.optional()
		})
		.optional()
});
