CREATE TABLE `farm_subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_record_id` text NOT NULL,
	`project_id` text NOT NULL,
	`event_type` text NOT NULL,
	`basis_expiry_date` text NOT NULL,
	`processed_at` text NOT NULL,
	`new_expiry_date` text DEFAULT '' NOT NULL,
	`recorder` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`farm_record_id`) REFERENCES `farm_records`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`) REFERENCES `smartfarm_projects`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_farm_subscription_events_type" CHECK("farm_subscription_events"."event_type" IN ('renewed', 'churned', 'rejoined')),
	CONSTRAINT "chk_farm_subscription_events_dates" CHECK(trim("farm_subscription_events"."basis_expiry_date") != '' AND trim("farm_subscription_events"."processed_at") != ''),
	CONSTRAINT "chk_farm_subscription_events_new_expiry" CHECK(("farm_subscription_events"."event_type" = 'churned' AND "farm_subscription_events"."new_expiry_date" = '') OR ("farm_subscription_events"."event_type" IN ('renewed', 'rejoined') AND "farm_subscription_events"."new_expiry_date" > "farm_subscription_events"."basis_expiry_date"))
);
--> statement-breakpoint
CREATE INDEX `idx_farm_subscription_events_basis` ON `farm_subscription_events` (`basis_expiry_date`,`event_type`);--> statement-breakpoint
CREATE INDEX `idx_farm_subscription_events_record_processed` ON `farm_subscription_events` (`farm_record_id`,`processed_at`);--> statement-breakpoint
CREATE INDEX `idx_farm_subscription_events_project_basis` ON `farm_subscription_events` (`project_id`,`basis_expiry_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_farm_subscription_events_outcome_once` ON `farm_subscription_events` (`farm_record_id`,`basis_expiry_date`) WHERE "farm_subscription_events"."event_type" IN ('renewed', 'churned');