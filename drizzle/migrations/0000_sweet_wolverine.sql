CREATE TABLE `cache` (
	`key` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cache_expiresAt` ON `cache` (`expiresAt`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_name_unique` ON `collections` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE TABLE `episode_watch_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`episode_id` integer NOT NULL,
	`watched` integer DEFAULT false NOT NULL,
	`watch_time` integer DEFAULT 0 NOT NULL,
	`total_time` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_episode_watch_status_user_id` ON `episode_watch_status` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_episode_watch_status_episode_id` ON `episode_watch_status` (`episode_id`);--> statement-breakpoint
CREATE INDEX `idx_episode_watch_status_watched` ON `episode_watch_status` (`watched`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_episode_watch_status_user_episode` ON `episode_watch_status` (`user_id`,`episode_id`);--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tv_show_id` integer NOT NULL,
	`season_id` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`name` text NOT NULL,
	`overview` text,
	`still_path` text,
	`air_date` text,
	`runtime_minutes` integer,
	`tmdb_id` integer,
	`imdb_id` text,
	`guest_stars` text,
	`crew` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tv_show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_episodes_tv_show_id` ON `episodes` (`tv_show_id`);--> statement-breakpoint
CREATE INDEX `idx_episodes_season_id` ON `episodes` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_episodes_episode_number` ON `episodes` (`episode_number`);--> statement-breakpoint
CREATE INDEX `idx_episodes_air_date` ON `episodes` (`air_date`);--> statement-breakpoint
CREATE INDEX `idx_episodes_tmdb_id` ON `episodes` (`tmdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_episodes_show_season_number` ON `episodes` (`tv_show_id`,`season_id`,`episode_number`);--> statement-breakpoint
CREATE TABLE `genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE TABLE `movie_people` (
	`movieId` text NOT NULL,
	`personId` integer NOT NULL,
	`role` text NOT NULL,
	`character` text,
	`job` text,
	`order` integer,
	`createdAt` integer NOT NULL,
	PRIMARY KEY(`movieId`, `personId`, `role`),
	FOREIGN KEY (`movieId`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personId`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_people_movie` ON `movie_people` (`movieId`);--> statement-breakpoint
CREATE INDEX `idx_movie_people_person` ON `movie_people` (`personId`);--> statement-breakpoint
CREATE INDEX `idx_movie_people_role` ON `movie_people` (`role`);--> statement-breakpoint
CREATE INDEX `idx_movie_people_order` ON `movie_people` (`order`);--> statement-breakpoint
CREATE TABLE `movies` (
	`numericId` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`tmdbId` integer NOT NULL,
	`title` text NOT NULL,
	`overview` text,
	`posterPath` text,
	`backdropPath` text,
	`releaseDate` text,
	`rating` real,
	`durationMinutes` integer,
	`is4K` integer DEFAULT false NOT NULL,
	`isHD` integer DEFAULT false NOT NULL,
	`language` text,
	`popularity` real,
	`collectionId` integer,
	`trailerUrl` text,
	`imdbId` text,
	`canonicalPath` text,
	`addedAt` integer,
	`mediaType` text DEFAULT 'movie' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`collectionId`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movies_id_unique` ON `movies` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `movies_tmdbId_unique` ON `movies` (`tmdbId`);--> statement-breakpoint
CREATE INDEX `idx_movies_tmdbId` ON `movies` (`tmdbId`);--> statement-breakpoint
CREATE INDEX `idx_movies_collectionId` ON `movies` (`collectionId`);--> statement-breakpoint
CREATE INDEX `idx_movies_rating` ON `movies` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_movies_language` ON `movies` (`language`);--> statement-breakpoint
CREATE INDEX `idx_movies_popularity` ON `movies` (`popularity`);--> statement-breakpoint
CREATE INDEX `idx_movies_releaseDate` ON `movies` (`releaseDate`);--> statement-breakpoint
CREATE INDEX `idx_movies_durationMinutes` ON `movies` (`durationMinutes`);--> statement-breakpoint
CREATE INDEX `idx_movies_mediaType` ON `movies` (`mediaType`);--> statement-breakpoint
CREATE INDEX `idx_movies_addedAt` ON `movies` (`addedAt`);--> statement-breakpoint
CREATE INDEX `idx_movies_imdbId` ON `movies` (`imdbId`);--> statement-breakpoint
CREATE TABLE `movies_genres` (
	`movieId` text NOT NULL,
	`genreId` integer NOT NULL,
	PRIMARY KEY(`movieId`, `genreId`),
	FOREIGN KEY (`movieId`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genreId`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movies_genres_movie` ON `movies_genres` (`movieId`);--> statement-breakpoint
CREATE INDEX `idx_movies_genres_genre` ON `movies_genres` (`genreId`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tmdbId` integer NOT NULL,
	`name` text NOT NULL,
	`biography` text,
	`birthday` text,
	`deathday` text,
	`placeOfBirth` text,
	`profilePath` text,
	`popularity` real,
	`knownForDepartment` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_tmdbId_unique` ON `people` (`tmdbId`);--> statement-breakpoint
CREATE INDEX `idx_people_tmdbId` ON `people` (`tmdbId`);--> statement-breakpoint
CREATE INDEX `idx_people_name` ON `people` (`name`);--> statement-breakpoint
CREATE INDEX `idx_people_popularity` ON `people` (`popularity`);--> statement-breakpoint
CREATE INDEX `idx_people_knownForDepartment` ON `people` (`knownForDepartment`);--> statement-breakpoint
CREATE TABLE `playback_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`media_id` text NOT NULL,
	`media_type` text NOT NULL,
	`progress` integer NOT NULL,
	`duration` integer NOT NULL,
	`season_number` integer,
	`episode_number` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_playback_progress_user` ON `playback_progress` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_playback_progress_media` ON `playback_progress` (`media_id`);--> statement-breakpoint
CREATE INDEX `idx_playback_progress_updated` ON `playback_progress` (`updated_at`);--> statement-breakpoint
CREATE TABLE `schema_info` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`query` text NOT NULL,
	`filters` text,
	`searched_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_search_history_user` ON `search_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_search_history_searched_at` ON `search_history` (`searched_at`);--> statement-breakpoint
CREATE TABLE `season_watch_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`season_id` integer NOT NULL,
	`episodes_watched` integer DEFAULT 0 NOT NULL,
	`total_episodes` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_season_watch_status_user_id` ON `season_watch_status` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_season_watch_status_season_id` ON `season_watch_status` (`season_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_season_watch_status_user_season` ON `season_watch_status` (`user_id`,`season_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tv_show_id` integer NOT NULL,
	`season_number` integer NOT NULL,
	`name` text NOT NULL,
	`overview` text,
	`poster_path` text,
	`air_date` text,
	`episode_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tv_show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_seasons_tv_show_id` ON `seasons` (`tv_show_id`);--> statement-breakpoint
CREATE INDEX `idx_seasons_season_number` ON `seasons` (`season_number`);--> statement-breakpoint
CREATE INDEX `idx_seasons_air_date` ON `seasons` (`air_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_seasons_show_number` ON `seasons` (`tv_show_id`,`season_number`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tv_show_watch_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`tv_show_id` integer NOT NULL,
	`status` text DEFAULT 'watching' NOT NULL,
	`seasons_completed` integer DEFAULT 0 NOT NULL,
	`total_seasons` integer DEFAULT 0 NOT NULL,
	`episodes_watched` integer DEFAULT 0 NOT NULL,
	`total_episodes` integer DEFAULT 0 NOT NULL,
	`rating` real,
	`notes` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tv_show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_show_watch_status_user_id` ON `tv_show_watch_status` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_show_watch_status_tv_show_id` ON `tv_show_watch_status` (`tv_show_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_show_watch_status_status` ON `tv_show_watch_status` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_tv_show_watch_status_user_show` ON `tv_show_watch_status` (`user_id`,`tv_show_id`);--> statement-breakpoint
CREATE TABLE `tv_shows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tmdb_id` integer NOT NULL,
	`imdb_id` text,
	`title` text NOT NULL,
	`overview` text,
	`poster_path` text,
	`backdrop_path` text,
	`first_air_date` text,
	`rating` real,
	`episode_run_time` integer,
	`number_of_seasons` integer,
	`number_of_episodes` integer,
	`status` text,
	`production_companies` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tv_shows_tmdb_id_unique` ON `tv_shows` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_tmdb_id` ON `tv_shows` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_imdb_id` ON `tv_shows` (`imdb_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_title` ON `tv_shows` (`title`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_first_air_date` ON `tv_shows` (`first_air_date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `watch_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`movie_id` text NOT NULL,
	`movie_data` text NOT NULL,
	`watched_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_history_user` ON `watch_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_history_watchedAt` ON `watch_history` (`watched_at`);--> statement-breakpoint
CREATE TABLE `watchlist` (
	`user_id` text NOT NULL,
	`movie_id` text NOT NULL,
	`movie_data` text NOT NULL,
	`added_at` integer NOT NULL,
	`folder_id` integer,
	PRIMARY KEY(`user_id`, `movie_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `watchlist_folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_watchlist_user` ON `watchlist` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_addedAt` ON `watchlist` (`added_at`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_folder` ON `watchlist` (`folder_id`);--> statement-breakpoint
CREATE TABLE `watchlist_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_watchlist_folders_user` ON `watchlist_folders` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_folders_name` ON `watchlist_folders` (`name`);--> statement-breakpoint
CREATE TABLE `watchlist_item_tags` (
	`user_id` text NOT NULL,
	`movie_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `movie_id`, `tag_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_watchlist_item_tags_user` ON `watchlist_item_tags` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_item_tags_movie` ON `watchlist_item_tags` (`movie_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_item_tags_tag` ON `watchlist_item_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `watchlist_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_watchlist_tags_user` ON `watchlist_tags` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_tags_name` ON `watchlist_tags` (`name`);