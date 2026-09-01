ALTER TABLE `farm_work_items` ADD COLUMN `expected_outcome` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD COLUMN `next_action` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD COLUMN `priority` text DEFAULT 'medium' NOT NULL
  CONSTRAINT `chk_farm_work_items_priority` CHECK (`priority` IN ('high', 'medium', 'low'));
--> statement-breakpoint
ALTER TABLE `farm_work_items` ADD COLUMN `review_date` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_farm_work_items_review_priority`
  ON `farm_work_items` (`status`, `review_date`, `priority`);
--> statement-breakpoint
CREATE TABLE `farm_inbox_items` (
  `id` text PRIMARY KEY NOT NULL,
  `channel` text NOT NULL,
  `sender` text DEFAULT '' NOT NULL,
  `content` text NOT NULL,
  `captured_by` text NOT NULL,
  `received_at` integer NOT NULL,
  `reference_url` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'unprocessed' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `chk_farm_inbox_channel`
    CHECK (`channel` IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
  CONSTRAINT `chk_farm_inbox_status`
    CHECK (`status` IN ('unprocessed', 'converted', 'reference', 'discarded'))
);
--> statement-breakpoint
CREATE INDEX `idx_farm_inbox_status_received`
  ON `farm_inbox_items` (`status`, `received_at`);
--> statement-breakpoint
CREATE TABLE `farm_inbox_conversions` (
  `inbox_item_id` text PRIMARY KEY NOT NULL,
  `work_item_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`inbox_item_id`) REFERENCES `farm_inbox_items`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`work_item_id`) REFERENCES `farm_work_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farm_inbox_conversions_work_item_id_unique`
  ON `farm_inbox_conversions` (`work_item_id`);
--> statement-breakpoint
CREATE TRIGGER `trg_farm_inbox_conversion_unprocessed`
BEFORE INSERT ON `farm_inbox_conversions`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `farm_inbox_items`
  WHERE `id` = NEW.`inbox_item_id` AND `status` = 'unprocessed'
)
BEGIN
  SELECT RAISE(ABORT, 'FARM_INBOX_ALREADY_PROCESSED');
END;
--> statement-breakpoint
CREATE TABLE `farm_work_checklist_items` (
  `id` text PRIMARY KEY NOT NULL,
  `work_item_id` text NOT NULL,
  `content` text NOT NULL,
  `is_completed` integer DEFAULT false NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `completed_by` text DEFAULT '' NOT NULL,
  `completed_at` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`work_item_id`) REFERENCES `farm_work_items`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `chk_farm_work_checklist_completed` CHECK (`is_completed` IN (0, 1)),
  CONSTRAINT `chk_farm_work_checklist_sort` CHECK (`sort_order` BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE INDEX `idx_farm_work_checklist_order`
  ON `farm_work_checklist_items` (`work_item_id`, `sort_order`, `created_at`);
--> statement-breakpoint
CREATE TRIGGER `trg_farm_work_complete_requires_checklist`
BEFORE UPDATE OF `status` ON `farm_work_items`
FOR EACH ROW
WHEN NEW.`status` = 'completed' AND EXISTS (
  SELECT 1 FROM `farm_work_checklist_items`
  WHERE `work_item_id` = NEW.`id` AND `is_completed` = 0
)
BEGIN
  SELECT RAISE(ABORT, 'FARM_CHECKLIST_INCOMPLETE');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_farm_completed_checklist_insert_lock`
BEFORE INSERT ON `farm_work_checklist_items`
FOR EACH ROW
WHEN NEW.`is_completed` = 0 AND EXISTS (
  SELECT 1 FROM `farm_work_items`
  WHERE `id` = NEW.`work_item_id` AND `status` = 'completed'
)
BEGIN
  SELECT RAISE(ABORT, 'FARM_COMPLETED_CHECKLIST_LOCKED');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_farm_completed_checklist_update_lock`
BEFORE UPDATE OF `is_completed` ON `farm_work_checklist_items`
FOR EACH ROW
WHEN NEW.`is_completed` = 0 AND EXISTS (
  SELECT 1 FROM `farm_work_items`
  WHERE `id` = NEW.`work_item_id` AND `status` = 'completed'
)
BEGIN
  SELECT RAISE(ABORT, 'FARM_COMPLETED_CHECKLIST_LOCKED');
END;
