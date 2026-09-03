CREATE TABLE "app_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_blocker_episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"reason" text NOT NULL,
	"blocked_by" text NOT NULL,
	"expected_unblock_date" text DEFAULT '' NOT NULL,
	"opened_at" bigint NOT NULL,
	"closed_at" bigint DEFAULT 0 NOT NULL,
	"resolution" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_blocker_episode_times" CHECK ("farm_blocker_episodes"."closed_at" = 0 OR "farm_blocker_episodes"."closed_at" >= "farm_blocker_episodes"."opened_at")
);
--> statement-breakpoint
CREATE TABLE "farm_history_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"channel" text NOT NULL,
	"sender" text DEFAULT '' NOT NULL,
	"received_content" text DEFAULT '' NOT NULL,
	"action_content" text DEFAULT '' NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"recorder" text NOT NULL,
	"occurred_at" bigint NOT NULL,
	"reference_url" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_history_entries_channel" CHECK ("farm_history_entries"."channel" IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
	CONSTRAINT "chk_farm_history_entries_amount" CHECK ("farm_history_entries"."amount" BETWEEN 0 AND 10000000000)
);
--> statement-breakpoint
CREATE TABLE "farm_inbox_conversions" (
	"inbox_item_id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "farm_inbox_conversions_work_item_id_unique" UNIQUE("work_item_id")
);
--> statement-breakpoint
CREATE TABLE "farm_inbox_items" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"sender" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"captured_by" text NOT NULL,
	"received_at" bigint NOT NULL,
	"reference_url" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'unprocessed' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_inbox_channel" CHECK ("farm_inbox_items"."channel" IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
	CONSTRAINT "chk_farm_inbox_status" CHECK ("farm_inbox_items"."status" IN ('unprocessed', 'converted', 'reference', 'discarded'))
);
--> statement-breakpoint
CREATE TABLE "farm_project_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"is_required" bigint DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"current_handler" text DEFAULT '' NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"submitted_at" text DEFAULT '' NOT NULL,
	"approved_at" text DEFAULT '' NOT NULL,
	"reference_url" text DEFAULT '' NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_project_documents_category" CHECK ("farm_project_documents"."category" IN ('agreement', 'farm', 'installation', 'inspection', 'settlement', 'other')),
	CONSTRAINT "chk_farm_project_documents_required" CHECK ("farm_project_documents"."is_required" IN (0, 1)),
	CONSTRAINT "chk_farm_project_documents_status" CHECK ("farm_project_documents"."status" IN ('not_started', 'preparing', 'submitted', 'reviewing', 'revision', 'approved', 'rejected')),
	CONSTRAINT "chk_farm_project_documents_revision" CHECK ("farm_project_documents"."revision" BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE TABLE "farm_project_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"channel" text NOT NULL,
	"sender" text DEFAULT '' NOT NULL,
	"received_content" text DEFAULT '' NOT NULL,
	"action_content" text DEFAULT '' NOT NULL,
	"recorder" text NOT NULL,
	"occurred_at" bigint NOT NULL,
	"reference_url" text DEFAULT '' NOT NULL,
	"blocked_reason" text DEFAULT '' NOT NULL,
	"blocked_by" text DEFAULT '' NOT NULL,
	"expected_unblock_date" text DEFAULT '' NOT NULL,
	"resolved_at" bigint DEFAULT 0 NOT NULL,
	"resolution" text DEFAULT '' NOT NULL,
	"resolved_by" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_project_updates_kind" CHECK ("farm_project_updates"."kind" IN ('communication', 'decision', 'blocker', 'system')),
	CONSTRAINT "chk_farm_project_updates_channel" CHECK ("farm_project_updates"."channel" IN ('email', 'kakao', 'verbal', 'phone', 'meeting', 'system', 'other')),
	CONSTRAINT "chk_farm_project_updates_resolution" CHECK ("farm_project_updates"."resolved_at" = 0 OR ("farm_project_updates"."kind" = 'blocker' AND "farm_project_updates"."resolved_at" >= "farm_project_updates"."occurred_at" AND trim("farm_project_updates"."resolution") != '' AND trim("farm_project_updates"."resolved_by") != ''))
);
--> statement-breakpoint
CREATE TABLE "farm_records" (
	"id" text PRIMARY KEY NOT NULL,
	"farm_id" text NOT NULL,
	"project_id" text NOT NULL,
	"crop" text DEFAULT '' NOT NULL,
	"device_type" text DEFAULT '' NOT NULL,
	"product_type" text DEFAULT '' NOT NULL,
	"vendor" text DEFAULT '' NOT NULL,
	"production_setup_date" text DEFAULT '' NOT NULL,
	"installation_date" text DEFAULT '' NOT NULL,
	"commissioning_date" text DEFAULT '' NOT NULL,
	"education_date" text DEFAULT '' NOT NULL,
	"internet_type" text DEFAULT '' NOT NULL,
	"warranty_years" bigint DEFAULT 1 NOT NULL,
	"warranty_expires_at" text DEFAULT '' NOT NULL,
	"subscription_years" bigint DEFAULT 1 NOT NULL,
	"initial_subscription_expires_at" text DEFAULT '' NOT NULL,
	"current_subscription_expires_at" text DEFAULT '' NOT NULL,
	"last_payment_date" text DEFAULT '' NOT NULL,
	"renewal_count" bigint DEFAULT 0 NOT NULL,
	"subscription_status" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"last_activity_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_records_warranty_years" CHECK ("farm_records"."warranty_years" BETWEEN 0 AND 20),
	CONSTRAINT "chk_farm_records_subscription_years" CHECK ("farm_records"."subscription_years" BETWEEN 0 AND 20),
	CONSTRAINT "chk_farm_records_renewal_count" CHECK ("farm_records"."renewal_count" BETWEEN 0 AND 100),
	CONSTRAINT "chk_farm_records_subscription_status" CHECK ("farm_records"."subscription_status" IN ('active', 'expired', 'unregistered'))
);
--> statement-breakpoint
CREATE TABLE "farm_subscription_events" (
	"id" text PRIMARY KEY NOT NULL,
	"farm_record_id" text NOT NULL,
	"project_id" text NOT NULL,
	"event_type" text NOT NULL,
	"basis_expiry_date" text NOT NULL,
	"processed_at" text NOT NULL,
	"new_expiry_date" text DEFAULT '' NOT NULL,
	"recorder" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_subscription_events_type" CHECK ("farm_subscription_events"."event_type" IN ('renewed', 'churned', 'rejoined')),
	CONSTRAINT "chk_farm_subscription_events_dates" CHECK (trim("farm_subscription_events"."basis_expiry_date") != '' AND trim("farm_subscription_events"."processed_at") != ''),
	CONSTRAINT "chk_farm_subscription_events_new_expiry" CHECK (("farm_subscription_events"."event_type" = 'churned' AND "farm_subscription_events"."new_expiry_date" = '') OR ("farm_subscription_events"."event_type" IN ('renewed', 'rejoined') AND "farm_subscription_events"."new_expiry_date" > "farm_subscription_events"."basis_expiry_date"))
);
--> statement-breakpoint
CREATE TABLE "farm_work_checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"content" text NOT NULL,
	"is_completed" bigint DEFAULT 0 NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"completed_by" text DEFAULT '' NOT NULL,
	"completed_at" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_work_checklist_completed" CHECK ("farm_work_checklist_items"."is_completed" IN (0, 1)),
	CONSTRAINT "chk_farm_work_checklist_sort" CHECK ("farm_work_checklist_items"."sort_order" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "farm_work_items" (
	"id" text PRIMARY KEY NOT NULL,
	"farm_record_id" text NOT NULL,
	"work_type" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"owner" text NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"expected_outcome" text DEFAULT '' NOT NULL,
	"next_action" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"review_date" text DEFAULT '' NOT NULL,
	"response_due_at" bigint DEFAULT 0 NOT NULL,
	"responded_at" bigint DEFAULT 0 NOT NULL,
	"blocked_at" bigint DEFAULT 0 NOT NULL,
	"blocked_reason" text DEFAULT '' NOT NULL,
	"blocked_by" text DEFAULT '' NOT NULL,
	"expected_unblock_date" text DEFAULT '' NOT NULL,
	"completed_at" bigint DEFAULT 0 NOT NULL,
	"last_activity_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_work_items_type" CHECK ("farm_work_items"."work_type" IN ('communication', 'installation', 'subscription', 'payment', 'service', 'note')),
	CONSTRAINT "chk_farm_work_items_status" CHECK ("farm_work_items"."status" IN ('open', 'in_progress', 'waiting', 'completed')),
	CONSTRAINT "chk_farm_work_items_priority" CHECK ("farm_work_items"."priority" IN ('high', 'medium', 'low'))
);
--> statement-breakpoint
CREATE TABLE "farm_work_visits" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"scheduled_at" bigint NOT NULL,
	"assigned_to" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"actual_started_at" bigint DEFAULT 0 NOT NULL,
	"actual_ended_at" bigint DEFAULT 0 NOT NULL,
	"preparation_note" text DEFAULT '' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"next_visit_at" bigint DEFAULT 0 NOT NULL,
	"recorded_by" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_farm_work_visits_status" CHECK ("farm_work_visits"."status" IN ('scheduled', 'completed', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" text PRIMARY KEY NOT NULL,
	"farm_code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"region" text NOT NULL,
	"business_number" text DEFAULT '' NOT NULL,
	"folder_url" text DEFAULT '' NOT NULL,
	"location_url" text DEFAULT '' NOT NULL,
	"special_notes" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"channel" text NOT NULL,
	"source_sender" text DEFAULT '' NOT NULL,
	"received_content" text DEFAULT '' NOT NULL,
	"action_content" text DEFAULT '' NOT NULL,
	"recorder" text NOT NULL,
	"occurred_at" bigint NOT NULL,
	"reference_url" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"client" text NOT NULL,
	"manager" text NOT NULL,
	"status" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smartfarm_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_type" text NOT NULL,
	"year" bigint NOT NULL,
	"institution" text NOT NULL,
	"status" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"target_farm_count" bigint DEFAULT 0 NOT NULL,
	"manager" text DEFAULT '' NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"end_date" text DEFAULT '' NOT NULL,
	"current_stage" text DEFAULT 'agreement' NOT NULL,
	"settlement_status" text DEFAULT 'not_started' NOT NULL,
	"settlement_due_date" text DEFAULT '' NOT NULL,
	"contract_amount" bigint DEFAULT 0 NOT NULL,
	"settlement_claim_amount" bigint DEFAULT 0 NOT NULL,
	"settlement_approved_amount" bigint DEFAULT 0 NOT NULL,
	"settlement_paid_amount" bigint DEFAULT 0 NOT NULL,
	"settled_at" text DEFAULT '' NOT NULL,
	"settlement_owner" text DEFAULT '' NOT NULL,
	"settlement_evidence_url" text DEFAULT '' NOT NULL,
	"settlement_note" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_smartfarm_projects_type" CHECK ("smartfarm_projects"."project_type" IN ('general', 'research')),
	CONSTRAINT "chk_smartfarm_projects_status" CHECK ("smartfarm_projects"."status" IN ('active', 'completed', 'on_hold')),
	CONSTRAINT "chk_smartfarm_projects_year" CHECK ("smartfarm_projects"."year" BETWEEN 2000 AND 2100),
	CONSTRAINT "chk_smartfarm_projects_target_count" CHECK ("smartfarm_projects"."target_farm_count" BETWEEN 0 AND 100000),
	CONSTRAINT "chk_smartfarm_projects_stage" CHECK ("smartfarm_projects"."current_stage" IN ('agreement', 'farm_selection', 'installation', 'verification', 'operation', 'settlement', 'closed')),
	CONSTRAINT "chk_smartfarm_projects_settlement_status" CHECK ("smartfarm_projects"."settlement_status" IN ('not_started', 'collecting', 'submitted', 'revision', 'approved', 'paid', 'closed')),
	CONSTRAINT "chk_smartfarm_projects_amounts" CHECK ("smartfarm_projects"."contract_amount" BETWEEN 0 AND 100000000000 AND "smartfarm_projects"."settlement_claim_amount" BETWEEN 0 AND 100000000000 AND "smartfarm_projects"."settlement_approved_amount" BETWEEN 0 AND 100000000000 AND "smartfarm_projects"."settlement_paid_amount" BETWEEN 0 AND 100000000000 AND "smartfarm_projects"."settlement_paid_amount" <= "smartfarm_projects"."settlement_approved_amount")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"assignee" text NOT NULL,
	"due_date" text NOT NULL,
	"category" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"owner" text NOT NULL,
	"due_date" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"last_activity_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_blocker_episodes" ADD CONSTRAINT "farm_blocker_episodes_work_item_id_farm_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."farm_work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_history_entries" ADD CONSTRAINT "farm_history_entries_work_item_id_farm_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."farm_work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_inbox_conversions" ADD CONSTRAINT "farm_inbox_conversions_inbox_item_id_farm_inbox_items_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."farm_inbox_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_inbox_conversions" ADD CONSTRAINT "farm_inbox_conversions_work_item_id_farm_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."farm_work_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_project_documents" ADD CONSTRAINT "farm_project_documents_project_id_smartfarm_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."smartfarm_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_project_updates" ADD CONSTRAINT "farm_project_updates_project_id_smartfarm_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."smartfarm_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_records" ADD CONSTRAINT "farm_records_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_records" ADD CONSTRAINT "farm_records_project_id_smartfarm_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."smartfarm_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_subscription_events" ADD CONSTRAINT "farm_subscription_events_farm_record_id_farm_records_id_fk" FOREIGN KEY ("farm_record_id") REFERENCES "public"."farm_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_subscription_events" ADD CONSTRAINT "farm_subscription_events_project_id_smartfarm_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."smartfarm_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_work_checklist_items" ADD CONSTRAINT "farm_work_checklist_items_work_item_id_farm_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."farm_work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_work_items" ADD CONSTRAINT "farm_work_items_farm_record_id_farm_records_id_fk" FOREIGN KEY ("farm_record_id") REFERENCES "public"."farm_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_work_visits" ADD CONSTRAINT "farm_work_visits_work_item_id_farm_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."farm_work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_entries" ADD CONSTRAINT "history_entries_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_farm_blocker_episodes_work_opened" ON "farm_blocker_episodes" USING btree ("work_item_id","opened_at");--> statement-breakpoint
CREATE INDEX "idx_farm_blocker_episodes_open" ON "farm_blocker_episodes" USING btree ("closed_at","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_farm_blocker_episodes_one_open" ON "farm_blocker_episodes" USING btree ("work_item_id") WHERE "farm_blocker_episodes"."closed_at" = 0;--> statement-breakpoint
CREATE INDEX "idx_farm_history_work_item_occurred" ON "farm_history_entries" USING btree ("work_item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_farm_history_occurred" ON "farm_history_entries" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_farm_inbox_status_received" ON "farm_inbox_items" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "idx_farm_project_documents_project_status" ON "farm_project_documents" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_farm_project_documents_due" ON "farm_project_documents" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "idx_farm_project_updates_project_occurred" ON "farm_project_updates" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_farm_project_updates_open_blockers" ON "farm_project_updates" USING btree ("project_id","occurred_at") WHERE "farm_project_updates"."kind" = 'blocker' AND "farm_project_updates"."resolved_at" = 0;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_farm_records_farm_project" ON "farm_records" USING btree ("farm_id","project_id");--> statement-breakpoint
CREATE INDEX "idx_farm_records_project_farm" ON "farm_records" USING btree ("project_id","farm_id");--> statement-breakpoint
CREATE INDEX "idx_farm_records_subscription_expiry" ON "farm_records" USING btree ("subscription_status","current_subscription_expires_at");--> statement-breakpoint
CREATE INDEX "idx_farm_records_last_activity" ON "farm_records" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "idx_farm_subscription_events_basis" ON "farm_subscription_events" USING btree ("basis_expiry_date","event_type");--> statement-breakpoint
CREATE INDEX "idx_farm_subscription_events_record_processed" ON "farm_subscription_events" USING btree ("farm_record_id","processed_at");--> statement-breakpoint
CREATE INDEX "idx_farm_subscription_events_project_basis" ON "farm_subscription_events" USING btree ("project_id","basis_expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_farm_subscription_events_outcome_once" ON "farm_subscription_events" USING btree ("farm_record_id","basis_expiry_date") WHERE "farm_subscription_events"."event_type" IN ('renewed', 'churned');--> statement-breakpoint
CREATE INDEX "idx_farm_work_checklist_order" ON "farm_work_checklist_items" USING btree ("work_item_id","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "idx_farm_work_items_record_activity" ON "farm_work_items" USING btree ("farm_record_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "idx_farm_work_items_status_due" ON "farm_work_items" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "idx_farm_work_items_type_status" ON "farm_work_items" USING btree ("work_type","status");--> statement-breakpoint
CREATE INDEX "idx_farm_work_items_review_priority" ON "farm_work_items" USING btree ("status","review_date","priority");--> statement-breakpoint
CREATE INDEX "idx_farm_work_items_response_risk" ON "farm_work_items" USING btree ("status","responded_at","response_due_at");--> statement-breakpoint
CREATE INDEX "idx_farm_work_items_blocked" ON "farm_work_items" USING btree ("status","blocked_at");--> statement-breakpoint
CREATE INDEX "idx_farm_work_visits_work_schedule" ON "farm_work_visits" USING btree ("work_item_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_farm_work_visits_status_schedule" ON "farm_work_visits" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_farms_farm_code" ON "farms" USING btree ("farm_code");--> statement-breakpoint
CREATE INDEX "idx_history_work_item_occurred" ON "history_entries" USING btree ("work_item_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_smartfarm_projects_status_year" ON "smartfarm_projects" USING btree ("status","year");--> statement-breakpoint
CREATE INDEX "idx_smartfarm_projects_stage_settlement" ON "smartfarm_projects" USING btree ("current_stage","settlement_status");--> statement-breakpoint
CREATE INDEX "idx_tasks_due_created" ON "tasks" USING btree ("due_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_work_items_project_activity" ON "work_items" USING btree ("project_id","last_activity_at");