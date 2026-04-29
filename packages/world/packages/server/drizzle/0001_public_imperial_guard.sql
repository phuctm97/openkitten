CREATE TABLE "cat" (
	"id" text PRIMARY KEY NOT NULL,
	"house_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"avatar" text,
	"mood" text DEFAULT 'awake' NOT NULL,
	"is_resting" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"author_user_id" text,
	"author_cat_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal" (
	"id" text PRIMARY KEY NOT NULL,
	"house_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"achieved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "memo" (
	"id" text PRIMARY KEY NOT NULL,
	"house_id" text NOT NULL,
	"author_user_id" text,
	"target_cat_id" text,
	"body" text NOT NULL,
	"pinned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice" (
	"id" text PRIMARY KEY NOT NULL,
	"house_id" text NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"thread_id" text,
	"cat_id" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule" (
	"id" text PRIMARY KEY NOT NULL,
	"house_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread" (
	"id" text PRIMARY KEY NOT NULL,
	"house_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_cat_id" text,
	"goal_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "cat" ADD CONSTRAINT "cat_house_id_house_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."house"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_thread_id_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_cat_id_cat_id_fk" FOREIGN KEY ("author_cat_id") REFERENCES "public"."cat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_house_id_house_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."house"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memo" ADD CONSTRAINT "memo_house_id_house_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."house"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memo" ADD CONSTRAINT "memo_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memo" ADD CONSTRAINT "memo_target_cat_id_cat_id_fk" FOREIGN KEY ("target_cat_id") REFERENCES "public"."cat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice" ADD CONSTRAINT "notice_house_id_house_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."house"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice" ADD CONSTRAINT "notice_thread_id_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice" ADD CONSTRAINT "notice_cat_id_cat_id_fk" FOREIGN KEY ("cat_id") REFERENCES "public"."cat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule" ADD CONSTRAINT "rule_house_id_house_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."house"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_house_id_house_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."house"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_assigned_cat_id_cat_id_fk" FOREIGN KEY ("assigned_cat_id") REFERENCES "public"."cat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cat_house_id_idx" ON "cat" USING btree ("house_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cat_house_id_slug_uidx" ON "cat" USING btree ("house_id","slug");--> statement-breakpoint
CREATE INDEX "comment_thread_id_idx" ON "comment" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "comment_thread_id_created_at_idx" ON "comment" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "goal_house_id_idx" ON "goal" USING btree ("house_id");--> statement-breakpoint
CREATE INDEX "goal_house_id_status_idx" ON "goal" USING btree ("house_id","status");--> statement-breakpoint
CREATE INDEX "memo_house_id_idx" ON "memo" USING btree ("house_id");--> statement-breakpoint
CREATE INDEX "memo_target_cat_id_idx" ON "memo" USING btree ("target_cat_id");--> statement-breakpoint
CREATE INDEX "memo_house_id_pinned_at_idx" ON "memo" USING btree ("house_id","pinned_at");--> statement-breakpoint
CREATE INDEX "notice_house_id_idx" ON "notice" USING btree ("house_id");--> statement-breakpoint
CREATE INDEX "notice_house_id_read_at_idx" ON "notice" USING btree ("house_id","read_at");--> statement-breakpoint
CREATE INDEX "notice_thread_id_idx" ON "notice" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "notice_cat_id_idx" ON "notice" USING btree ("cat_id");--> statement-breakpoint
CREATE INDEX "rule_house_id_idx" ON "rule" USING btree ("house_id");--> statement-breakpoint
CREATE INDEX "rule_house_id_enabled_idx" ON "rule" USING btree ("house_id","enabled");--> statement-breakpoint
CREATE INDEX "thread_house_id_idx" ON "thread" USING btree ("house_id");--> statement-breakpoint
CREATE INDEX "thread_house_id_status_idx" ON "thread" USING btree ("house_id","status");--> statement-breakpoint
CREATE INDEX "thread_assigned_cat_id_idx" ON "thread" USING btree ("assigned_cat_id");--> statement-breakpoint
CREATE INDEX "thread_goal_id_idx" ON "thread" USING btree ("goal_id");