CREATE TABLE `world_players` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`pet` text NOT NULL,
	`image` text,
	`x` real NOT NULL,
	`z` real NOT NULL,
	`mask` integer DEFAULT 0 NOT NULL,
	`sequence` real DEFAULT -1 NOT NULL,
	`changed_at` real NOT NULL,
	`seen` real NOT NULL
);
