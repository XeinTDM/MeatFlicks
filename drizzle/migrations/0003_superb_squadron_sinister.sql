PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_episode_watch_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`episode_id` text NOT NULL,
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
INSERT INTO `__new_episode_watch_status`("id", "user_id", "episode_id", "watched", "watch_time", "total_time", "completed_at", "created_at", "updated_at") SELECT "id", "user_id", "episode_id", "watched", "watch_time", "total_time", "completed_at", "created_at", "updated_at" FROM `episode_watch_status`;--> statement-breakpoint
DROP TABLE `episode_watch_status`;--> statement-breakpoint
ALTER TABLE `__new_episode_watch_status` RENAME TO `episode_watch_status`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_episode_watch_status_user_id` ON `episode_watch_status` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_episode_watch_status_episode_id` ON `episode_watch_status` (`episode_id`);--> statement-breakpoint
CREATE INDEX `idx_episode_watch_status_watched` ON `episode_watch_status` (`watched`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_episode_watch_status_user_episode` ON `episode_watch_status` (`user_id`,`episode_id`);--> statement-breakpoint
CREATE TABLE `__new_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`tv_show_id` text NOT NULL,
	`season_id` text NOT NULL,
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
INSERT INTO `__new_episodes`("id", "tv_show_id", "season_id", "episode_number", "name", "overview", "still_path", "air_date", "runtime_minutes", "tmdb_id", "imdb_id", "guest_stars", "crew", "created_at", "updated_at") SELECT "id", "tv_show_id", "season_id", "episode_number", "name", "overview", "still_path", "air_date", "runtime_minutes", "tmdb_id", "imdb_id", "guest_stars", "crew", "created_at", "updated_at" FROM `episodes`;--> statement-breakpoint
DROP TABLE `episodes`;--> statement-breakpoint
ALTER TABLE `__new_episodes` RENAME TO `episodes`;--> statement-breakpoint
CREATE INDEX `idx_episodes_tv_show_id` ON `episodes` (`tv_show_id`);--> statement-breakpoint
CREATE INDEX `idx_episodes_season_id` ON `episodes` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_episodes_episode_number` ON `episodes` (`episode_number`);--> statement-breakpoint
CREATE INDEX `idx_episodes_air_date` ON `episodes` (`air_date`);--> statement-breakpoint
CREATE INDEX `idx_episodes_tmdb_id` ON `episodes` (`tmdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_episodes_show_season_number` ON `episodes` (`tv_show_id`,`season_id`,`episode_number`);--> statement-breakpoint
CREATE TABLE `__new_movie_people` (
	`movieId` text NOT NULL,
	`personId` text NOT NULL,
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
INSERT INTO `__new_movie_people`("movieId", "personId", "role", "character", "job", "order", "createdAt") SELECT "movieId", "personId", "role", "character", "job", "order", "createdAt" FROM `movie_people`;--> statement-breakpoint
DROP TABLE `movie_people`;--> statement-breakpoint
ALTER TABLE `__new_movie_people` RENAME TO `movie_people`;--> statement-breakpoint
CREATE INDEX `idx_movie_people_movie` ON `movie_people` (`movieId`);--> statement-breakpoint
CREATE INDEX `idx_movie_people_person` ON `movie_people` (`personId`);--> statement-breakpoint
CREATE INDEX `idx_movie_people_role` ON `movie_people` (`role`);--> statement-breakpoint
CREATE INDEX `idx_movie_people_order` ON `movie_people` (`order`);--> statement-breakpoint
CREATE TABLE `__new_people` (
	`id` text PRIMARY KEY NOT NULL,
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
INSERT INTO `__new_people`("id", "tmdbId", "name", "biography", "birthday", "deathday", "placeOfBirth", "profilePath", "popularity", "knownForDepartment", "createdAt", "updatedAt") SELECT "id", "tmdbId", "name", "biography", "birthday", "deathday", "placeOfBirth", "profilePath", "popularity", "knownForDepartment", "createdAt", "updatedAt" FROM `people`;--> statement-breakpoint
DROP TABLE `people`;--> statement-breakpoint
ALTER TABLE `__new_people` RENAME TO `people`;--> statement-breakpoint
CREATE UNIQUE INDEX `people_tmdbId_unique` ON `people` (`tmdbId`);--> statement-breakpoint
CREATE INDEX `idx_people_tmdbId` ON `people` (`tmdbId`);--> statement-breakpoint
CREATE INDEX `idx_people_name` ON `people` (`name`);--> statement-breakpoint
CREATE INDEX `idx_people_popularity` ON `people` (`popularity`);--> statement-breakpoint
CREATE INDEX `idx_people_knownForDepartment` ON `people` (`knownForDepartment`);--> statement-breakpoint
CREATE TABLE `__new_season_watch_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`season_id` text NOT NULL,
	`episodes_watched` integer DEFAULT 0 NOT NULL,
	`total_episodes` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_season_watch_status`("id", "user_id", "season_id", "episodes_watched", "total_episodes", "completed_at", "created_at", "updated_at") SELECT "id", "user_id", "season_id", "episodes_watched", "total_episodes", "completed_at", "created_at", "updated_at" FROM `season_watch_status`;--> statement-breakpoint
DROP TABLE `season_watch_status`;--> statement-breakpoint
ALTER TABLE `__new_season_watch_status` RENAME TO `season_watch_status`;--> statement-breakpoint
CREATE INDEX `idx_season_watch_status_user_id` ON `season_watch_status` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_season_watch_status_season_id` ON `season_watch_status` (`season_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_season_watch_status_user_season` ON `season_watch_status` (`user_id`,`season_id`);--> statement-breakpoint
CREATE TABLE `__new_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`tv_show_id` text NOT NULL,
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
INSERT INTO `__new_seasons`("id", "tv_show_id", "season_number", "name", "overview", "poster_path", "air_date", "episode_count", "created_at", "updated_at") SELECT "id", "tv_show_id", "season_number", "name", "overview", "poster_path", "air_date", "episode_count", "created_at", "updated_at" FROM `seasons`;--> statement-breakpoint
DROP TABLE `seasons`;--> statement-breakpoint
ALTER TABLE `__new_seasons` RENAME TO `seasons`;--> statement-breakpoint
CREATE INDEX `idx_seasons_tv_show_id` ON `seasons` (`tv_show_id`);--> statement-breakpoint
CREATE INDEX `idx_seasons_season_number` ON `seasons` (`season_number`);--> statement-breakpoint
CREATE INDEX `idx_seasons_air_date` ON `seasons` (`air_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_seasons_show_number` ON `seasons` (`tv_show_id`,`season_number`);--> statement-breakpoint
CREATE TABLE `__new_tv_show_watch_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`tv_show_id` text NOT NULL,
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
INSERT INTO `__new_tv_show_watch_status`("id", "user_id", "tv_show_id", "status", "seasons_completed", "total_seasons", "episodes_watched", "total_episodes", "rating", "notes", "started_at", "completed_at", "created_at", "updated_at") SELECT "id", "user_id", "tv_show_id", "status", "seasons_completed", "total_seasons", "episodes_watched", "total_episodes", "rating", "notes", "started_at", "completed_at", "created_at", "updated_at" FROM `tv_show_watch_status`;--> statement-breakpoint
DROP TABLE `tv_show_watch_status`;--> statement-breakpoint
ALTER TABLE `__new_tv_show_watch_status` RENAME TO `tv_show_watch_status`;--> statement-breakpoint
CREATE INDEX `idx_tv_show_watch_status_user_id` ON `tv_show_watch_status` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_show_watch_status_tv_show_id` ON `tv_show_watch_status` (`tv_show_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_show_watch_status_status` ON `tv_show_watch_status` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `unq_tv_show_watch_status_user_show` ON `tv_show_watch_status` (`user_id`,`tv_show_id`);--> statement-breakpoint
CREATE TABLE `__new_tv_shows` (
	`id` text PRIMARY KEY NOT NULL,
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
	`streamingProviders` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tv_shows`("id", "tmdb_id", "imdb_id", "title", "overview", "poster_path", "backdrop_path", "first_air_date", "rating", "episode_run_time", "number_of_seasons", "number_of_episodes", "status", "production_companies", "streamingProviders", "created_at", "updated_at") SELECT "id", "tmdb_id", "imdb_id", "title", "overview", "poster_path", "backdrop_path", "first_air_date", "rating", "episode_run_time", "number_of_seasons", "number_of_episodes", "status", "production_companies", "streamingProviders", "created_at", "updated_at" FROM `tv_shows`;--> statement-breakpoint
DROP TABLE `tv_shows`;--> statement-breakpoint
ALTER TABLE `__new_tv_shows` RENAME TO `tv_shows`;--> statement-breakpoint
CREATE UNIQUE INDEX `tv_shows_tmdb_id_unique` ON `tv_shows` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_tmdb_id` ON `tv_shows` (`tmdb_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_imdb_id` ON `tv_shows` (`imdb_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_title` ON `tv_shows` (`title`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_first_air_date` ON `tv_shows` (`first_air_date`);--> statement-breakpoint
CREATE TABLE `__new_tv_shows_genres` (
	`tv_show_id` text NOT NULL,
	`genre_id` integer NOT NULL,
	PRIMARY KEY(`tv_show_id`, `genre_id`),
	FOREIGN KEY (`tv_show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tv_shows_genres`("tv_show_id", "genre_id") SELECT "tv_show_id", "genre_id" FROM `tv_shows_genres`;--> statement-breakpoint
DROP TABLE `tv_shows_genres`;--> statement-breakpoint
ALTER TABLE `__new_tv_shows_genres` RENAME TO `tv_shows_genres`;--> statement-breakpoint
CREATE INDEX `idx_tv_shows_genres_tv_show` ON `tv_shows_genres` (`tv_show_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_genres_genre` ON `tv_shows_genres` (`genre_id`);