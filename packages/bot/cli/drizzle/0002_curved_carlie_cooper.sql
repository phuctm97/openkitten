CREATE TABLE `command` (
	`name` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`prompt` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
