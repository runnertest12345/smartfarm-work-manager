CREATE TABLE `history_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`channel` text NOT NULL,
	`source_sender` text DEFAULT '' NOT NULL,
	`received_content` text DEFAULT '' NOT NULL,
	`action_content` text DEFAULT '' NOT NULL,
	`recorder` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`reference_url` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_history_work_item_occurred` ON `history_entries` (`work_item_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client` text NOT NULL,
	`manager` text NOT NULL,
	`status` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`owner` text NOT NULL,
	`due_date` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`last_activity_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_work_items_project_activity` ON `work_items` (`project_id`,`last_activity_at`);