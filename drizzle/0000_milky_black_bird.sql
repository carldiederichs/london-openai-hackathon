CREATE TABLE `feral_games` (
	`code` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`lease` text DEFAULT '' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feral_images` (
	`room` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`room`, `id`)
);
--> statement-breakpoint
CREATE TABLE `feral_sessions` (
	`room` text NOT NULL,
	`token` text NOT NULL,
	`session` text NOT NULL,
	`view` text NOT NULL,
	`input` text,
	`seq` integer DEFAULT -1 NOT NULL,
	`seen` integer NOT NULL,
	PRIMARY KEY(`room`, `token`)
);
