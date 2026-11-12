CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"status" text DEFAULT 'pending_password' NOT NULL,
	"first_login_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_username_canonical" CHECK ("users"."username" = lower(btrim("users"."username")) AND length("users"."username") > 0),
	CONSTRAINT "users_role_valid" CHECK ("users"."role" IN ('admin', 'student')),
	CONSTRAINT "users_status_valid" CHECK ("users"."status" IN ('pending_password', 'active', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "auth_sessions_kind_valid" CHECK ("auth_sessions"."kind" IN ('password_setup', 'authenticated')),
	CONSTRAINT "auth_sessions_lifetime_valid" CHECK ("auth_sessions"."expires_at" > "auth_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_code" text NOT NULL,
	"question_type" text NOT NULL,
	"prompt" text,
	"choices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_choice_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" text DEFAULT 'needs_review' NOT NULL,
	"source_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_source_unique" UNIQUE("topic_code","source_number"),
	CONSTRAINT "questions_topic_valid" CHECK ("questions"."topic_code" IN ('cca-f', 'ccao-f', 'ccar-p')),
	CONSTRAINT "questions_type_valid" CHECK ("questions"."question_type" IN ('single_choice', 'multiple_response', 'unsupported')),
	CONSTRAINT "questions_status_valid" CHECK ("questions"."status" IN ('ready', 'needs_review', 'disabled')),
	CONSTRAINT "questions_source_positive" CHECK ("questions"."source_number" > 0),
	CONSTRAINT "questions_choices_array" CHECK (jsonb_typeof("questions"."choices") = 'array'),
	CONSTRAINT "questions_ready_structure" CHECK ("questions"."status" <> 'ready' OR (
    "questions"."prompt" IS NOT NULL AND length(btrim("questions"."prompt")) > 0
    AND CASE WHEN jsonb_typeof("questions"."choices") = 'array' THEN jsonb_array_length("questions"."choices") >= 2 ELSE false END
    AND (("questions"."question_type" = 'single_choice' AND cardinality("questions"."correct_choice_ids") = 1)
      OR ("questions"."question_type" = 'multiple_response' AND cardinality("questions"."correct_choice_ids") >= 2))
  ))
);
--> statement-breakpoint
CREATE TABLE "exam_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_code" text NOT NULL,
	"seed" text NOT NULL,
	"bank_version" text NOT NULL,
	"generator_version" text NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_cycles_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "exam_cycles_topic_valid" CHECK ("exam_cycles"."topic_code" IN ('cca-f', 'ccao-f', 'ccar-p'))
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"form_number" smallint NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"total" integer NOT NULL,
	"correct" integer,
	"wrong" integer,
	"unanswered" integer,
	"simulated_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_attempts_cycle_form_unique" UNIQUE("cycle_id","form_number"),
	CONSTRAINT "exam_attempts_status_valid" CHECK ("exam_attempts"."status" IN ('in_progress', 'submitted', 'abandoned', 'timed_out')),
	CONSTRAINT "exam_attempts_form_range" CHECK ("exam_attempts"."form_number" BETWEEN 1 AND 10),
	CONSTRAINT "exam_attempts_total_positive" CHECK ("exam_attempts"."total" > 0),
	CONSTRAINT "exam_attempts_deadline_exact" CHECK ("exam_attempts"."expires_at" = "exam_attempts"."started_at" + interval '120 minutes'),
	CONSTRAINT "exam_attempts_results_state" CHECK ((
    "exam_attempts"."status" = 'in_progress'
    AND "exam_attempts"."ended_at" IS NULL AND "exam_attempts"."finalized_at" IS NULL
    AND "exam_attempts"."correct" IS NULL AND "exam_attempts"."wrong" IS NULL AND "exam_attempts"."unanswered" IS NULL AND "exam_attempts"."simulated_score" IS NULL
  ) OR (
    "exam_attempts"."status" <> 'in_progress'
    AND "exam_attempts"."ended_at" IS NOT NULL AND "exam_attempts"."finalized_at" IS NOT NULL
    AND "exam_attempts"."correct" IS NOT NULL AND "exam_attempts"."wrong" IS NOT NULL AND "exam_attempts"."unanswered" IS NOT NULL AND "exam_attempts"."simulated_score" IS NOT NULL
    AND "exam_attempts"."correct" >= 0 AND "exam_attempts"."wrong" >= 0 AND "exam_attempts"."unanswered" >= 0
    AND "exam_attempts"."correct" + "exam_attempts"."wrong" + "exam_attempts"."unanswered" = "exam_attempts"."total"
    AND "exam_attempts"."simulated_score" BETWEEN 100 AND 1000
    AND "exam_attempts"."simulated_score" = round(100 + 900.0 * "exam_attempts"."correct" / "exam_attempts"."total")
    AND "exam_attempts"."ended_at" >= "exam_attempts"."started_at" AND "exam_attempts"."ended_at" <= "exam_attempts"."expires_at"
    AND "exam_attempts"."finalized_at" >= "exam_attempts"."ended_at"
    AND ("exam_attempts"."status" <> 'timed_out' OR "exam_attempts"."ended_at" = "exam_attempts"."expires_at")
  ))
);
--> statement-breakpoint
CREATE TABLE "exam_attempt_payloads" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"question_snapshot" jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_payloads_snapshot_array" CHECK (jsonb_typeof("exam_attempt_payloads"."question_snapshot") = 'array'),
	CONSTRAINT "exam_payloads_answers_object" CHECK (jsonb_typeof("exam_attempt_payloads"."answers") = 'object')
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limits_count_nonnegative" CHECK ("rate_limits"."count" >= 0),
	CONSTRAINT "rate_limits_window_valid" CHECK ("rate_limits"."expires_at" > "rate_limits"."window_started_at")
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_action_valid" CHECK ("admin_audit_logs"."action" IN ('create_user', 'disable_user', 'enable_user', 'reset_password')),
	CONSTRAINT "admin_audit_metadata_object" CHECK (jsonb_typeof("admin_audit_logs"."metadata") = 'object')
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_cycles" ADD CONSTRAINT "exam_cycles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_cycle_owner_fk" FOREIGN KEY ("cycle_id","user_id") REFERENCES "public"."exam_cycles"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempt_payloads" ADD CONSTRAINT "exam_attempt_payloads_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expiry_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "questions_topic_status_idx" ON "questions" USING btree ("topic_code","status");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_cycles_current_unique" ON "exam_cycles" USING btree ("user_id","topic_code") WHERE "exam_cycles"."closed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_attempts_active_user_unique" ON "exam_attempts" USING btree ("user_id") WHERE "exam_attempts"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "exam_attempts_active_expiry_idx" ON "exam_attempts" USING btree ("expires_at") WHERE "exam_attempts"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "exam_attempts_user_started_idx" ON "exam_attempts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "rate_limits_expiry_idx" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "admin_audit_actor_created_idx" ON "admin_audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_target_created_idx" ON "admin_audit_logs" USING btree ("target_user_id","created_at");