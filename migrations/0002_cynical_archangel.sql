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
CREATE INDEX `idx_watchlist_tags_name` ON `watchlist_tags` (`name`);--> statement-breakpoint
ALTER TABLE `watchlist` ADD `folder_id` integer REFERENCES watchlist_folders(id);--> statement-breakpoint
CREATE INDEX `idx_watchlist_folder` ON `watchlist` (`folder_id`);