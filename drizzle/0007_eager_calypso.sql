CREATE TABLE `farm_project_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`channel` text NOT NULL,
	`sender` text DEFAULT '' NOT NULL,
	`received_content` text DEFAULT '' NOT NULL,
	`action_content` text DEFAULT '' NOT NULL,
	`recorder` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`reference_url` text DEFAULT '' NOT NULL,
	`blocked_reason` text DEFAULT '' NOT NULL,
	`blocked_by` text DEFAULT '' NOT NULL,
	`expected_unblock_date` text DEFAULT '' NOT NULL,
	`resolved_at` integer DEFAULT 0 NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`resolved_by` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `smartfarm_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_farm_project_updates_kind" CHECK("farm_project_updates"."kind" IN ('communication', 'decision', 'blocker', 'system')),
	CONSTRAINT "chk_farm_project_updates_channel" CHECK("farm_project_updates"."channel" IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
	CONSTRAINT "chk_farm_project_updates_resolution" CHECK("farm_project_updates"."resolved_at" = 0 OR ("farm_project_updates"."kind" = 'blocker' AND "farm_project_updates"."resolved_at" >= "farm_project_updates"."occurred_at" AND trim("farm_project_updates"."resolution") != '' AND trim("farm_project_updates"."resolved_by") != ''))
);
--> statement-breakpoint
CREATE INDEX `idx_farm_project_updates_project_occurred` ON `farm_project_updates` (`project_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_farm_project_updates_open_blockers` ON `farm_project_updates` (`project_id`,`occurred_at`) WHERE "farm_project_updates"."kind" = 'blocker' AND "farm_project_updates"."resolved_at" = 0;--> statement-breakpoint
INSERT OR IGNORE INTO `farm_project_updates` (
	`id`, `project_id`, `kind`, `title`, `channel`, `sender`,
	`received_content`, `action_content`, `recorder`, `occurred_at`,
	`reference_url`, `blocked_reason`, `blocked_by`, `expected_unblock_date`,
	`resolved_at`, `resolution`, `resolved_by`, `created_at`, `updated_at`
)
SELECT
	`id` || ':update:legacy-close-review', `id`, 'system',
	'기존 완료 사업 근거 재확인', 'system', '', '',
	'기존 완료 상태는 정산·필수서류 근거 확인을 위해 보류·정산 단계로 다시 열었습니다.',
	CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END,
	`updated_at`, '', '', '', '', 0, '', '', `updated_at`, `updated_at`
FROM `smartfarm_projects`
WHERE `status` = 'on_hold'
	AND `current_stage` = 'settlement'
	AND instr(`settlement_note`, '기존 완료 사업: 정산·필수서류 근거를 확인한 뒤 다시 마감해 주세요.') > 0;--> statement-breakpoint
CREATE TRIGGER `trg_farm_records_project_unique_insert`
BEFORE INSERT ON `farm_records`
FOR EACH ROW WHEN EXISTS (
	SELECT 1 FROM `farm_records`
	WHERE `farm_id` = NEW.`farm_id` AND `project_id` = NEW.`project_id`
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_RECORD_PROJECT_EXISTS');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_records_project_unique_update`
BEFORE UPDATE OF `farm_id`, `project_id` ON `farm_records`
FOR EACH ROW WHEN (NEW.`farm_id` != OLD.`farm_id` OR NEW.`project_id` != OLD.`project_id`)
AND EXISTS (
	SELECT 1 FROM `farm_records`
	WHERE `farm_id` = NEW.`farm_id` AND `project_id` = NEW.`project_id` AND `id` != OLD.`id`
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_RECORD_PROJECT_EXISTS');
END;--> statement-breakpoint
CREATE TRIGGER `trg_smartfarm_project_state_insert`
BEFORE INSERT ON `smartfarm_projects`
FOR EACH ROW WHEN (NEW.`status` = 'completed' AND NEW.`current_stage` != 'closed')
	OR (NEW.`status` != 'completed' AND NEW.`current_stage` = 'closed')
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_STAGE_STATUS_INVALID');
END;--> statement-breakpoint
CREATE TRIGGER `trg_smartfarm_project_completed_insert`
BEFORE INSERT ON `smartfarm_projects`
FOR EACH ROW WHEN NEW.`status` = 'completed'
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETION_REQUIREMENTS_MISSING');
END;--> statement-breakpoint
CREATE TRIGGER `trg_smartfarm_project_state_update`
BEFORE UPDATE OF `status`, `current_stage` ON `smartfarm_projects`
FOR EACH ROW WHEN (NEW.`status` = 'completed' AND NEW.`current_stage` != 'closed')
	OR (NEW.`status` != 'completed' AND NEW.`current_stage` = 'closed')
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_STAGE_STATUS_INVALID');
END;--> statement-breakpoint
CREATE TRIGGER `trg_smartfarm_project_completion_update`
BEFORE UPDATE OF `status` ON `smartfarm_projects`
FOR EACH ROW WHEN OLD.`status` != 'completed' AND NEW.`status` = 'completed' AND (
	NEW.`current_stage` != 'closed' OR
	NEW.`settlement_status` NOT IN ('paid', 'closed') OR
	trim(NEW.`settled_at`) = '' OR
	NOT EXISTS (
		SELECT 1 FROM `farm_project_documents`
		WHERE `project_id` = NEW.`id` AND `is_required` = 1
	) OR
	EXISTS (
		SELECT 1 FROM `farm_project_documents`
		WHERE `project_id` = NEW.`id` AND `is_required` = 1 AND `status` != 'approved'
	) OR
	EXISTS (
		SELECT 1 FROM `farm_project_updates`
		WHERE `project_id` = NEW.`id` AND `kind` = 'blocker' AND `resolved_at` = 0
	) OR
	EXISTS (
		SELECT 1 FROM `farm_work_items` wi
		INNER JOIN `farm_records` fr ON fr.`id` = wi.`farm_record_id`
		WHERE fr.`project_id` = NEW.`id` AND wi.`status` != 'completed'
	) OR
	(
		NEW.`target_farm_count` > 0 AND
		(SELECT COUNT(DISTINCT `farm_id`) FROM `farm_records` WHERE `project_id` = NEW.`id`) < NEW.`target_farm_count`
	)
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETION_REQUIREMENTS_MISSING');
END;--> statement-breakpoint
CREATE TRIGGER `trg_smartfarm_project_completed_fields_update`
BEFORE UPDATE OF `target_farm_count`, `start_date`, `end_date`,
	`settlement_status`, `settlement_due_date`, `contract_amount`,
	`settlement_claim_amount`, `settlement_approved_amount`,
	`settlement_paid_amount`, `settled_at`, `settlement_evidence_url`
ON `smartfarm_projects`
FOR EACH ROW WHEN OLD.`status` = 'completed' AND NEW.`status` = 'completed' AND (
	NEW.`target_farm_count` != OLD.`target_farm_count` OR
	NEW.`start_date` != OLD.`start_date` OR NEW.`end_date` != OLD.`end_date` OR
	NEW.`settlement_status` != OLD.`settlement_status` OR
	NEW.`settlement_due_date` != OLD.`settlement_due_date` OR
	NEW.`contract_amount` != OLD.`contract_amount` OR
	NEW.`settlement_claim_amount` != OLD.`settlement_claim_amount` OR
	NEW.`settlement_approved_amount` != OLD.`settlement_approved_amount` OR
	NEW.`settlement_paid_amount` != OLD.`settlement_paid_amount` OR
	NEW.`settled_at` != OLD.`settled_at` OR
	NEW.`settlement_evidence_url` != OLD.`settlement_evidence_url`
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_project_document_completed_insert`
BEFORE INSERT ON `farm_project_documents`
FOR EACH ROW WHEN EXISTS (
	SELECT 1 FROM `smartfarm_projects`
	WHERE `id` = NEW.`project_id` AND `status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_project_document_completed_update`
BEFORE UPDATE ON `farm_project_documents`
FOR EACH ROW WHEN EXISTS (
	SELECT 1 FROM `smartfarm_projects`
	WHERE `id` = NEW.`project_id` AND `status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_project_document_completed_delete`
BEFORE DELETE ON `farm_project_documents`
FOR EACH ROW WHEN EXISTS (
	SELECT 1 FROM `smartfarm_projects`
	WHERE `id` = OLD.`project_id` AND `status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_record_completed_project_insert`
BEFORE INSERT ON `farm_records`
FOR EACH ROW WHEN EXISTS (
	SELECT 1 FROM `smartfarm_projects`
	WHERE `id` = NEW.`project_id` AND `status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_record_completed_project_update`
BEFORE UPDATE OF `project_id` ON `farm_records`
FOR EACH ROW WHEN NEW.`project_id` != OLD.`project_id` AND (
	EXISTS (
		SELECT 1 FROM `smartfarm_projects`
		WHERE `id` = OLD.`project_id` AND `status` = 'completed'
	) OR EXISTS (
		SELECT 1 FROM `smartfarm_projects`
		WHERE `id` = NEW.`project_id` AND `status` = 'completed'
	)
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_record_completed_project_delete`
BEFORE DELETE ON `farm_records`
FOR EACH ROW WHEN EXISTS (
	SELECT 1 FROM `smartfarm_projects`
	WHERE `id` = OLD.`project_id` AND `status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_work_completed_project_insert`
BEFORE INSERT ON `farm_work_items`
FOR EACH ROW WHEN NEW.`status` != 'completed' AND EXISTS (
	SELECT 1 FROM `farm_records` fr
	INNER JOIN `smartfarm_projects` p ON p.`id` = fr.`project_id`
	WHERE fr.`id` = NEW.`farm_record_id` AND p.`status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_work_completed_project_reopen`
BEFORE UPDATE OF `status` ON `farm_work_items`
FOR EACH ROW WHEN OLD.`status` = 'completed' AND NEW.`status` != 'completed' AND EXISTS (
	SELECT 1 FROM `farm_records` fr
	INNER JOIN `smartfarm_projects` p ON p.`id` = fr.`project_id`
	WHERE fr.`id` = NEW.`farm_record_id` AND p.`status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;--> statement-breakpoint
CREATE TRIGGER `trg_farm_project_blocker_completed_insert`
BEFORE INSERT ON `farm_project_updates`
FOR EACH ROW WHEN NEW.`kind` = 'blocker' AND EXISTS (
	SELECT 1 FROM `smartfarm_projects`
	WHERE `id` = NEW.`project_id` AND `status` = 'completed'
)
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_COMPLETED_LOCKED');
END;
