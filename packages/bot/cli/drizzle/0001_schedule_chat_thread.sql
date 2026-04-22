CREATE TABLE `__new_schedule` (
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
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_schedule` (
	`id`, `chat_id`, `thread_id`, `description`, `prompt`, `cron`,
	`timezone`, `once`, `enabled`, `overlap`, `notify_on_failure`,
	`max_runtime_ms`, `created_at`, `updated_at`
)
SELECT
	`schedule`.`id`,
	`session`.`chat_id`,
	`session`.`thread_id`,
	`schedule`.`description`,
	`schedule`.`prompt`,
	`schedule`.`cron`,
	`schedule`.`timezone`,
	`schedule`.`once`,
	`schedule`.`enabled`,
	`schedule`.`overlap`,
	`schedule`.`notify_on_failure`,
	`schedule`.`max_runtime_ms`,
	`schedule`.`created_at`,
	`schedule`.`updated_at`
FROM `schedule`
JOIN `session` ON `schedule`.`session_id` = `session`.`id`;
--> statement-breakpoint
DROP TABLE `schedule`;
--> statement-breakpoint
ALTER TABLE `__new_schedule` RENAME TO `schedule`;
--> statement-breakpoint
CREATE INDEX `schedule_chat_id_thread_id_idx` ON `schedule` (`chat_id`,`thread_id`);
--> statement-breakpoint
CREATE TABLE `__new_schedule_run` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`session_id` text,
	`queue_job_id` text,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`output` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedule`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_schedule_run` (
	`id`, `schedule_id`, `session_id`, `queue_job_id`, `trigger`,
	`status`, `started_at`, `finished_at`, `output`, `error`,
	`created_at`, `updated_at`
)
SELECT
	`id`, `schedule_id`, `session_id`, `queue_job_id`, `trigger`,
	`status`, `started_at`, `finished_at`, `output`, `error`,
	`created_at`, `updated_at`
FROM `schedule_run`;
--> statement-breakpoint
DROP TABLE `schedule_run`;
--> statement-breakpoint
ALTER TABLE `__new_schedule_run` RENAME TO `schedule_run`;
--> statement-breakpoint
CREATE INDEX `schedule_run_schedule_id_idx` ON `schedule_run` (`schedule_id`);
--> statement-breakpoint
CREATE INDEX `schedule_run_session_id_idx` ON `schedule_run` (`session_id`);
--> statement-breakpoint
CREATE INDEX `schedule_run_status_started_at_idx` ON `schedule_run` (`status`,`started_at`);
