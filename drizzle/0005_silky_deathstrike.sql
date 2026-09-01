CREATE TABLE `farm_blocker_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`reason` text NOT NULL,
	`blocked_by` text NOT NULL,
	`expected_unblock_date` text DEFAULT '' NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer DEFAULT 0 NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `farm_work_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_farm_blocker_episode_times" CHECK("farm_blocker_episodes"."closed_at" = 0 OR "farm_blocker_episodes"."closed_at" >= "farm_blocker_episodes"."opened_at")
);
--> statement-breakpoint
CREATE INDEX `idx_farm_blocker_episodes_work_opened` ON `farm_blocker_episodes` (`work_item_id`,`opened_at`);--> statement-breakpoint
CREATE INDEX `idx_farm_blocker_episodes_open` ON `farm_blocker_episodes` (`closed_at`,`opened_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_farm_blocker_episodes_one_open` ON `farm_blocker_episodes` (`work_item_id`) WHERE "farm_blocker_episodes"."closed_at" = 0;--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD `completed_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `farm_work_visits` ADD `preparation_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `farm_work_visits` ADD `recorded_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `farm_work_items`
SET `completed_at` = `last_activity_at`
WHERE `status` = 'completed' AND `completed_at` = 0;--> statement-breakpoint
UPDATE `farm_work_visits`
SET `recorded_by` = `assigned_to`
WHERE trim(`recorded_by`) = '';--> statement-breakpoint
UPDATE `farm_work_visits`
SET `preparation_note` = CASE
		WHEN trim(`preparation_note`) = '' THEN `result`
		ELSE `preparation_note`
	END,
	`actual_started_at` = 0,
	`actual_ended_at` = 0,
	`result` = '',
	`next_visit_at` = 0
WHERE `status` = 'scheduled';--> statement-breakpoint
INSERT INTO `farm_blocker_episodes` (
	`id`, `work_item_id`, `reason`, `blocked_by`, `expected_unblock_date`,
	`opened_at`, `closed_at`, `resolution`, `created_at`, `updated_at`
)
SELECT
	'legacy-blocker-' || `id`, `id`, `blocked_reason`, `blocked_by`,
	`expected_unblock_date`, `blocked_at`, 0, '', `blocked_at`, `updated_at`
FROM `farm_work_items`
WHERE `status` = 'waiting'
	AND NOT EXISTS (
		SELECT 1 FROM `farm_blocker_episodes`
		WHERE `farm_blocker_episodes`.`work_item_id` = `farm_work_items`.`id`
			AND `farm_blocker_episodes`.`closed_at` = 0
	);--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_farm_visit_details_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `trg_farm_visit_details_update`;--> statement-breakpoint
CREATE TRIGGER `trg_farm_visit_details_insert`
BEFORE INSERT ON `farm_work_visits`
FOR EACH ROW
WHEN (
	NEW.`status` = 'completed' AND (
		NEW.`actual_started_at` = 0 OR NEW.`actual_ended_at` = 0 OR
		NEW.`actual_ended_at` <= NEW.`actual_started_at` OR
		NEW.`actual_started_at` > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 300000 OR
		NEW.`actual_ended_at` > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 300000 OR
		trim(NEW.`result`) = ''
	)
) OR (
	NEW.`status` = 'canceled' AND (
		trim(NEW.`result`) = '' OR NEW.`actual_started_at` != 0 OR NEW.`actual_ended_at` != 0
	)
) OR (
	NEW.`status` = 'scheduled' AND (
		NEW.`actual_started_at` != 0 OR NEW.`actual_ended_at` != 0 OR
		trim(NEW.`result`) != '' OR NEW.`next_visit_at` != 0
	)
) OR trim(NEW.`recorded_by`) = '' OR (
	NEW.`next_visit_at` != 0 AND NEW.`next_visit_at` <= CASE
		WHEN NEW.`status` = 'completed' AND
			NEW.`actual_ended_at` > CAST(strftime('%s', 'now') AS INTEGER) * 1000
		THEN NEW.`actual_ended_at`
		ELSE CAST(strftime('%s', 'now') AS INTEGER) * 1000
	END
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_VISIT_DETAILS_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_visit_details_update`
BEFORE UPDATE OF `status`, `actual_started_at`, `actual_ended_at`, `result`, `next_visit_at`, `recorded_by`
ON `farm_work_visits`
FOR EACH ROW
WHEN (
	NEW.`status` = 'completed' AND (
		NEW.`actual_started_at` = 0 OR NEW.`actual_ended_at` = 0 OR
		NEW.`actual_ended_at` <= NEW.`actual_started_at` OR
		NEW.`actual_started_at` > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 300000 OR
		NEW.`actual_ended_at` > CAST(strftime('%s', 'now') AS INTEGER) * 1000 + 300000 OR
		trim(NEW.`result`) = ''
	)
) OR (
	NEW.`status` = 'canceled' AND (
		trim(NEW.`result`) = '' OR NEW.`actual_started_at` != 0 OR NEW.`actual_ended_at` != 0
	)
) OR (
	NEW.`status` = 'scheduled' AND (
		NEW.`actual_started_at` != 0 OR NEW.`actual_ended_at` != 0 OR
		trim(NEW.`result`) != '' OR NEW.`next_visit_at` != 0
	)
) OR trim(NEW.`recorded_by`) = '' OR (
	NEW.`next_visit_at` != 0 AND NEW.`next_visit_at` <= CASE
		WHEN NEW.`status` = 'completed' AND
			NEW.`actual_ended_at` > CAST(strftime('%s', 'now') AS INTEGER) * 1000
		THEN NEW.`actual_ended_at`
		ELSE CAST(strftime('%s', 'now') AS INTEGER) * 1000
	END
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_VISIT_DETAILS_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_completed_work_visit_insert_lock`
BEFORE INSERT ON `farm_work_visits`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `farm_work_items`
	WHERE `id` = NEW.`work_item_id` AND `status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_WORK_COMPLETED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_visit_terminal_lock`
BEFORE UPDATE ON `farm_work_visits`
FOR EACH ROW
WHEN OLD.`status` IN ('completed', 'canceled')
BEGIN
	SELECT RAISE(ABORT, 'FARM_VISIT_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_work_completed_time_insert`
BEFORE INSERT ON `farm_work_items`
FOR EACH ROW
WHEN (NEW.`status` = 'completed' AND NEW.`completed_at` = 0) OR
	(NEW.`status` != 'completed' AND NEW.`completed_at` != 0)
BEGIN
	SELECT RAISE(ABORT, 'FARM_COMPLETED_TIME_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_work_completed_time_update`
BEFORE UPDATE OF `status`, `completed_at` ON `farm_work_items`
FOR EACH ROW
WHEN (NEW.`status` = 'completed' AND NEW.`completed_at` = 0) OR
	(NEW.`status` != 'completed' AND NEW.`completed_at` != 0)
BEGIN
	SELECT RAISE(ABORT, 'FARM_COMPLETED_TIME_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_waiting_requires_open_episode`
BEFORE UPDATE OF `status` ON `farm_work_items`
FOR EACH ROW
WHEN NEW.`status` = 'waiting' AND NOT EXISTS (
	SELECT 1 FROM `farm_blocker_episodes`
	WHERE `work_item_id` = NEW.`id` AND `closed_at` = 0
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_BLOCKER_EPISODE_REQUIRED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_nonwaiting_rejects_open_episode`
BEFORE UPDATE OF `status` ON `farm_work_items`
FOR EACH ROW
WHEN NEW.`status` != 'waiting' AND EXISTS (
	SELECT 1 FROM `farm_blocker_episodes`
	WHERE `work_item_id` = NEW.`id` AND `closed_at` = 0
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_BLOCKER_EPISODE_OPEN');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_work_complete_requires_visits`
BEFORE UPDATE OF `status` ON `farm_work_items`
FOR EACH ROW
WHEN NEW.`status` = 'completed' AND EXISTS (
	SELECT 1 FROM `farm_work_visits`
	WHERE `work_item_id` = NEW.`id` AND `status` = 'scheduled'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_VISIT_PENDING');
END;
