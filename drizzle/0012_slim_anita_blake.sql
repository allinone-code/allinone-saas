CREATE TABLE "crawler_capture_tokens" (
	"user_email" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"rotated_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "crawler_capture_tokens_hash_idx" ON "crawler_capture_tokens" USING btree ("token_hash");