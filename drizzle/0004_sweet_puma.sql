CREATE TABLE `farm_work_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`assigned_to` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`actual_started_at` integer DEFAULT 0 NOT NULL,
	`actual_ended_at` integer DEFAULT 0 NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`next_visit_at` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `farm_work_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_farm_work_visits_status" CHECK("farm_work_visits"."status" IN ('scheduled', 'completed', 'canceled'))
);
--> statement-breakpoint
CREATE INDEX `idx_farm_work_visits_work_schedule` ON `farm_work_visits` (`work_item_id`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_farm_work_visits_status_schedule` ON `farm_work_visits` (`status`,`scheduled_at`);--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD `response_due_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD `responded_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD `blocked_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD `blocked_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD `blocked_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD `expected_unblock_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `farm_work_items`
SET `blocked_at` = CASE WHEN `blocked_at` = 0 THEN `last_activity_at` ELSE `blocked_at` END,
	`blocked_reason` = CASE WHEN trim(`blocked_reason`) = '' THEN '기존 대기 업무 - 사유 확인 필요' ELSE `blocked_reason` END,
	`blocked_by` = CASE WHEN trim(`blocked_by`) = '' THEN '담당자 확인 필요' ELSE `blocked_by` END
WHERE `status` = 'waiting';--> statement-breakpoint
UPDATE `farm_work_items`
SET `response_due_at` = `last_activity_at` + CASE
		WHEN `priority` = 'high' THEN 86400000
		WHEN `priority` = 'medium' THEN 259200000
		ELSE 604800000
	END,
	`responded_at` = CASE
		WHEN `id` IN ('sf-work-sample-003', 'sf-work-sample-005') THEN 0
		ELSE `last_activity_at`
	END
WHERE `id` LIKE 'sf-work-sample-%';--> statement-breakpoint
CREATE INDEX `idx_farm_work_items_response_risk` ON `farm_work_items` (`status`,`responded_at`,`response_due_at`);--> statement-breakpoint
CREATE INDEX `idx_farm_work_items_blocked` ON `farm_work_items` (`status`,`blocked_at`);--> statement-breakpoint
CREATE TRIGGER `trg_farm_waiting_requires_blocker_insert`
BEFORE INSERT ON `farm_work_items`
FOR EACH ROW
WHEN NEW.`status` = 'waiting' AND (
	trim(NEW.`blocked_reason`) = '' OR trim(NEW.`blocked_by`) = ''
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_BLOCKER_DETAILS_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_waiting_requires_blocker_update`
BEFORE UPDATE OF `status`, `blocked_reason`, `blocked_by` ON `farm_work_items`
FOR EACH ROW
WHEN NEW.`status` = 'waiting' AND (
	trim(NEW.`blocked_reason`) = '' OR trim(NEW.`blocked_by`) = ''
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_BLOCKER_DETAILS_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_visit_details_insert`
BEFORE INSERT ON `farm_work_visits`
FOR EACH ROW
WHEN (
	NEW.`status` = 'completed' AND (
		NEW.`actual_started_at` = 0 OR NEW.`actual_ended_at` = 0 OR
		NEW.`actual_ended_at` < NEW.`actual_started_at` OR trim(NEW.`result`) = ''
	)
) OR (NEW.`status` = 'canceled' AND trim(NEW.`result`) = '')
BEGIN
	SELECT RAISE(ABORT, 'FARM_VISIT_DETAILS_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_visit_details_update`
BEFORE UPDATE OF `status`, `actual_started_at`, `actual_ended_at`, `result` ON `farm_work_visits`
FOR EACH ROW
WHEN (
	NEW.`status` = 'completed' AND (
		NEW.`actual_started_at` = 0 OR NEW.`actual_ended_at` = 0 OR
		NEW.`actual_ended_at` < NEW.`actual_started_at` OR trim(NEW.`result`) = ''
	)
) OR (NEW.`status` = 'canceled' AND trim(NEW.`result`) = '')
BEGIN
	SELECT RAISE(ABORT, 'FARM_VISIT_DETAILS_REQUIRED');
END;
