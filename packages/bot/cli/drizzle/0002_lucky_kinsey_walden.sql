PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_schedule_run` (
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
INSERT INTO `__new_schedule_run`("id", "schedule_id", "run_session_id", "queue_job_id", "trigger", "status", "started_at", "finished_at", "output", "error", "created_at", "updated_at") SELECT "id", "schedule_id", "run_session_id", "queue_job_id", "trigger", "status", "started_at", "finished_at", "output", "error", "created_at", "updated_at" FROM `schedule_run`;--> statement-breakpoint
DROP TABLE `schedule_run`;--> statement-breakpoint
ALTER TABLE `__new_schedule_run` RENAME TO `schedule_run`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `schedule_run_schedule_id_idx` ON `schedule_run` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `schedule_run_status_started_at_idx` ON `schedule_run` (`status`,`started_at`);--> statement-breakpoint
ALTER TABLE `schedule` ADD `session_id` text;