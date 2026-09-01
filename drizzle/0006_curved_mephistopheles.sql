ALTER TABLE `smartfarm_projects` ADD `manager` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `start_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `end_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `current_stage` text DEFAULT 'agreement' NOT NULL CHECK (`current_stage` IN ('agreement', 'farm_selection', 'installation', 'verification', 'operation', 'settlement', 'closed'));--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settlement_status` text DEFAULT 'not_started' NOT NULL CHECK (`settlement_status` IN ('not_started', 'collecting', 'submitted', 'revision', 'approved', 'paid', 'closed'));--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settlement_due_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `contract_amount` integer DEFAULT 0 NOT NULL CHECK (`contract_amount` BETWEEN 0 AND 100000000000);--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settlement_claim_amount` integer DEFAULT 0 NOT NULL CHECK (`settlement_claim_amount` BETWEEN 0 AND 100000000000);--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settlement_approved_amount` integer DEFAULT 0 NOT NULL CHECK (`settlement_approved_amount` BETWEEN 0 AND 100000000000);--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settlement_paid_amount` integer DEFAULT 0 NOT NULL CHECK (`settlement_paid_amount` BETWEEN 0 AND 100000000000);--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settled_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settlement_owner` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settlement_evidence_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `smartfarm_projects` ADD `settlement_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `smartfarm_projects`
SET `status` = 'on_hold',
	`current_stage` = 'settlement',
	`settlement_note` = CASE
		WHEN trim(`settlement_note`) = '' THEN '기존 완료 사업: 정산·필수서류 근거를 확인한 뒤 다시 마감해 주세요.'
		ELSE `settlement_note` || char(10) || '기존 완료 사업: 정산·필수서류 근거를 확인한 뒤 다시 마감해 주세요.'
	END
WHERE `status` = 'completed';--> statement-breakpoint
CREATE TRIGGER `trg_smartfarm_project_amounts_insert`
BEFORE INSERT ON `smartfarm_projects`
FOR EACH ROW WHEN NEW.`settlement_paid_amount` > NEW.`settlement_approved_amount`
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_SETTLEMENT_AMOUNTS_INVALID');
END;--> statement-breakpoint
CREATE TRIGGER `trg_smartfarm_project_amounts_update`
BEFORE UPDATE OF `settlement_approved_amount`, `settlement_paid_amount` ON `smartfarm_projects`
FOR EACH ROW WHEN NEW.`settlement_paid_amount` > NEW.`settlement_approved_amount`
BEGIN
	SELECT RAISE(ABORT, 'FARM_PROJECT_SETTLEMENT_AMOUNTS_INVALID');
END;--> statement-breakpoint
CREATE INDEX `idx_smartfarm_projects_stage_settlement` ON `smartfarm_projects` (`current_stage`,`settlement_status`);--> statement-breakpoint
CREATE TABLE `farm_project_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`is_required` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`current_handler` text DEFAULT '' NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`submitted_at` text DEFAULT '' NOT NULL,
	`approved_at` text DEFAULT '' NOT NULL,
	`reference_url` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `smartfarm_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_farm_project_documents_category" CHECK("farm_project_documents"."category" IN ('agreement', 'farm', 'installation', 'inspection', 'settlement', 'other')),
	CONSTRAINT "chk_farm_project_documents_required" CHECK("farm_project_documents"."is_required" IN (0, 1)),
	CONSTRAINT "chk_farm_project_documents_status" CHECK("farm_project_documents"."status" IN ('not_started', 'preparing', 'submitted', 'reviewing', 'revision', 'approved', 'rejected')),
	CONSTRAINT "chk_farm_project_documents_revision" CHECK("farm_project_documents"."revision" BETWEEN 1 AND 1000)
);--> statement-breakpoint
INSERT OR IGNORE INTO `farm_project_documents` (`id`,`project_id`,`title`,`category`,`is_required`,`status`,`owner`,`current_handler`,`due_date`,`submitted_at`,`approved_at`,`reference_url`,`revision`,`note`,`created_at`,`updated_at`)
SELECT `id` || ':doc:agreement', `id`, '협약서·계약서', 'agreement', 1, 'not_started', CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, '', '', '', '', 1, '', `created_at`, `updated_at` FROM `smartfarm_projects`;--> statement-breakpoint
INSERT OR IGNORE INTO `farm_project_documents` (`id`,`project_id`,`title`,`category`,`is_required`,`status`,`owner`,`current_handler`,`due_date`,`submitted_at`,`approved_at`,`reference_url`,`revision`,`note`,`created_at`,`updated_at`)
SELECT `id` || ':doc:farm', `id`, '참여농가 확정 명단', 'farm', 1, 'not_started', CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, '', '', '', '', 1, '', `created_at`, `updated_at` FROM `smartfarm_projects`;--> statement-breakpoint
INSERT OR IGNORE INTO `farm_project_documents` (`id`,`project_id`,`title`,`category`,`is_required`,`status`,`owner`,`current_handler`,`due_date`,`submitted_at`,`approved_at`,`reference_url`,`revision`,`note`,`created_at`,`updated_at`)
SELECT `id` || ':doc:installation', `id`, '설치·시운전 확인서', 'installation', 1, 'not_started', CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, '', '', '', '', 1, '', `created_at`, `updated_at` FROM `smartfarm_projects`;--> statement-breakpoint
INSERT OR IGNORE INTO `farm_project_documents` (`id`,`project_id`,`title`,`category`,`is_required`,`status`,`owner`,`current_handler`,`due_date`,`submitted_at`,`approved_at`,`reference_url`,`revision`,`note`,`created_at`,`updated_at`)
SELECT `id` || ':doc:inspection', `id`, '검수·교육 확인서', 'inspection', 1, 'not_started', CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, '', '', '', '', 1, '', `created_at`, `updated_at` FROM `smartfarm_projects`;--> statement-breakpoint
INSERT OR IGNORE INTO `farm_project_documents` (`id`,`project_id`,`title`,`category`,`is_required`,`status`,`owner`,`current_handler`,`due_date`,`submitted_at`,`approved_at`,`reference_url`,`revision`,`note`,`created_at`,`updated_at`)
SELECT `id` || ':doc:settlement', `id`, '정산보고서·증빙', 'settlement', 1, 'not_started', CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, CASE WHEN trim(`manager`) = '' THEN '담당자 미지정' ELSE `manager` END, '', '', '', '', 1, '', `created_at`, `updated_at` FROM `smartfarm_projects`;--> statement-breakpoint
CREATE INDEX `idx_farm_project_documents_project_status` ON `farm_project_documents` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_farm_project_documents_due` ON `farm_project_documents` (`status`,`due_date`);
