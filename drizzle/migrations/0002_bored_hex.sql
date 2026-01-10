CREATE TABLE `tv_shows_genres` (
	`tv_show_id` integer NOT NULL,
	`genre_id` integer NOT NULL,
	PRIMARY KEY(`tv_show_id`, `genre_id`),
	FOREIGN KEY (`tv_show_id`) REFERENCES `tv_shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tv_shows_genres_tv_show` ON `tv_shows_genres` (`tv_show_id`);--> statement-breakpoint
CREATE INDEX `idx_tv_shows_genres_genre` ON `tv_shows_genres` (`genre_id`);--> statement-breakpoint
ALTER TABLE `movies` ADD `streamingProviders` text;--> statement-breakpoint
CREATE INDEX `idx_movies_trailerUrl` ON `movies` (`trailerUrl`);--> statement-breakpoint
CREATE INDEX `idx_movies_common_sort` ON `movies` (`rating`,`releaseDate`,`title`);--> statement-breakpoint
ALTER TABLE `tv_shows` ADD `streamingProviders` text;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'USER' NOT NULL;