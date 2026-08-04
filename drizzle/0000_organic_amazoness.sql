CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`canon_status` text DEFAULT 'canon' NOT NULL,
	`source` text NOT NULL,
	`source_date` text NOT NULL,
	`salience` integer DEFAULT 50 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `memories_owner_archive_updated_idx` ON `memories` (`owner_key`,`archived`,`updated_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`client_message_id` text,
	`owner_key` text NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`grounding` text DEFAULT 'preserved-source' NOT NULL,
	`model` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_owner_thread_created_idx` ON `messages` (`owner_key`,`thread_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_owner_client_idx` ON `messages` (`owner_key`,`client_message_id`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `receipts_owner_created_idx` ON `receipts` (`owner_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `threads_owner_updated_idx` ON `threads` (`owner_key`,`updated_at`);--> statement-breakpoint
CREATE TABLE `venice_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`name` text DEFAULT 'Venice' NOT NULL,
	`constitution` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venice_profiles_owner_idx` ON `venice_profiles` (`owner_key`);