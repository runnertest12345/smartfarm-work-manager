CREATE TABLE `farm_history_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`channel` text NOT NULL,
	`sender` text DEFAULT '' NOT NULL,
	`received_content` text DEFAULT '' NOT NULL,
	`action_content` text DEFAULT '' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`recorder` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`reference_url` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `farm_work_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_farm_history_entries_channel" CHECK("farm_history_entries"."channel" IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
	CONSTRAINT "chk_farm_history_entries_amount" CHECK("farm_history_entries"."amount" BETWEEN 0 AND 10000000000)
);
--> statement-breakpoint
CREATE INDEX `idx_farm_history_work_item_occurred` ON `farm_history_entries` (`work_item_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_farm_history_occurred` ON `farm_history_entries` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `farm_records` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`project_id` text NOT NULL,
	`crop` text DEFAULT '' NOT NULL,
	`device_type` text DEFAULT '' NOT NULL,
	`product_type` text DEFAULT '' NOT NULL,
	`vendor` text DEFAULT '' NOT NULL,
	`production_setup_date` text DEFAULT '' NOT NULL,
	`installation_date` text DEFAULT '' NOT NULL,
	`commissioning_date` text DEFAULT '' NOT NULL,
	`education_date` text DEFAULT '' NOT NULL,
	`internet_type` text DEFAULT '' NOT NULL,
	`warranty_years` integer DEFAULT 1 NOT NULL,
	`warranty_expires_at` text DEFAULT '' NOT NULL,
	`subscription_years` integer DEFAULT 1 NOT NULL,
	`initial_subscription_expires_at` text DEFAULT '' NOT NULL,
	`current_subscription_expires_at` text DEFAULT '' NOT NULL,
	`last_payment_date` text DEFAULT '' NOT NULL,
	`renewal_count` integer DEFAULT 0 NOT NULL,
	`subscription_status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`last_activity_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `smartfarm_projects`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_farm_records_warranty_years" CHECK("farm_records"."warranty_years" BETWEEN 0 AND 20),
	CONSTRAINT "chk_farm_records_subscription_years" CHECK("farm_records"."subscription_years" BETWEEN 0 AND 20),
	CONSTRAINT "chk_farm_records_renewal_count" CHECK("farm_records"."renewal_count" BETWEEN 0 AND 100),
	CONSTRAINT "chk_farm_records_subscription_status" CHECK("farm_records"."subscription_status" IN ('active', 'expired', 'unregistered'))
);
--> statement-breakpoint
CREATE INDEX `idx_farm_records_farm_project` ON `farm_records` (`farm_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `idx_farm_records_project_farm` ON `farm_records` (`project_id`,`farm_id`);--> statement-breakpoint
CREATE INDEX `idx_farm_records_subscription_expiry` ON `farm_records` (`subscription_status`,`current_subscription_expires_at`);--> statement-breakpoint
CREATE INDEX `idx_farm_records_last_activity` ON `farm_records` (`last_activity_at`);--> statement-breakpoint
CREATE TABLE `farm_work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_record_id` text NOT NULL,
	`work_type` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`owner` text NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`last_activity_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_record_id`) REFERENCES `farm_records`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_farm_work_items_type" CHECK("farm_work_items"."work_type" IN ('communication', 'installation', 'subscription', 'payment', 'service', 'note')),
	CONSTRAINT "chk_farm_work_items_status" CHECK("farm_work_items"."status" IN ('open', 'in_progress', 'waiting', 'completed'))
);
--> statement-breakpoint
CREATE INDEX `idx_farm_work_items_record_activity` ON `farm_work_items` (`farm_record_id`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `idx_farm_work_items_status_due` ON `farm_work_items` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_farm_work_items_type_status` ON `farm_work_items` (`work_type`,`status`);--> statement-breakpoint
CREATE TABLE `farms` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_code` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`region` text NOT NULL,
	`business_number` text DEFAULT '' NOT NULL,
	`folder_url` text DEFAULT '' NOT NULL,
	`location_url` text DEFAULT '' NOT NULL,
	`special_notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_farms_farm_code` ON `farms` (`farm_code`);--> statement-breakpoint
CREATE TABLE `smartfarm_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`project_type` text NOT NULL,
	`year` integer NOT NULL,
	`institution` text NOT NULL,
	`status` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`target_farm_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "chk_smartfarm_projects_type" CHECK("smartfarm_projects"."project_type" IN ('general', 'research')),
	CONSTRAINT "chk_smartfarm_projects_status" CHECK("smartfarm_projects"."status" IN ('active', 'completed', 'on_hold')),
	CONSTRAINT "chk_smartfarm_projects_year" CHECK("smartfarm_projects"."year" BETWEEN 2000 AND 2100),
	CONSTRAINT "chk_smartfarm_projects_target_count" CHECK("smartfarm_projects"."target_farm_count" BETWEEN 0 AND 100000)
);
--> statement-breakpoint
CREATE INDEX `idx_smartfarm_projects_status_year` ON `smartfarm_projects` (`status`,`year`);