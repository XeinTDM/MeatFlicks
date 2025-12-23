PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_episode_watch_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`episode_id` integer NOT NULL,
	`watched` integer DEFAULT false NOT NULL,
	`watch_time` integer DEFAULT 0 NOT NULL,
	`total_time` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `episode_id`),
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
CREATE TABLE `__new_movies` (
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
INSERT INTO `__new_movies`("numericId", "id", "tmdbId", "title", "overview", "posterPath", "backdropPath", "releaseDate", "rating", "durationMinutes", "is4K", "isHD", "language", "popularity", "collectionId", "trailerUrl", "imdbId", "canonicalPath", "addedAt", "mediaType", "createdAt", "updatedAt") SELECT "numericId", "id", "tmdbId", "title", "overview", "posterPath", "backdropPath", "releaseDate", "rating", "durationMinutes", "is4K", "isHD", "language", "popularity", "collectionId", "trailerUrl", "imdbId", "canonicalPath", "addedAt", "mediaType", "createdAt", "updatedAt" FROM `movies`;--> statement-breakpoint
DROP TABLE `movies`;--> statement-breakpoint
ALTER TABLE `__new_movies` RENAME TO `movies`;--> statement-breakpoint
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
ALTER TABLE `movie_people` DROP COLUMN `id`;