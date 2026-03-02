CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`active_session_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
