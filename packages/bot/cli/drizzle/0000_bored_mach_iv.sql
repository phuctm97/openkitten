CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_session_id_idx` ON `message` (`session_id`);--> statement-breakpoint
CREATE TABLE `restart_notification` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` integer NOT NULL,
	`thread_id` integer DEFAULT 0 NOT NULL,
	`message` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` integer NOT NULL,
	`thread_id` integer DEFAULT 0 NOT NULL,
	`description` text NOT NULL,
	`prompt` text NOT NULL,
	`cron` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`once` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`overlap` text DEFAULT 'queue' NOT NULL,
	`notify_on_failure` integer DEFAULT false NOT NULL,
	`max_runtime_ms` integer,
	`session_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `schedule_chat_id_thread_id_idx` ON `schedule` (`chat_id`,`thread_id`);--> statement-breakpoint
CREATE TABLE `schedule_run` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`run_session_id` text,
	`queue_job_id` text,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`output` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedule`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedule_run_schedule_id_idx` ON `schedule_run` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `schedule_run_status_started_at_idx` ON `schedule_run` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` integer NOT NULL,
	`thread_id` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`agent` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_chat_id_thread_id_idx` ON `session` (`chat_id`,`thread_id`);