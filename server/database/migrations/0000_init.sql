CREATE TABLE "demos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"project" integer,
	"host" text NOT NULL,
	"path" text NOT NULL,
	"commit" text NOT NULL,
	"entry" text NOT NULL,
	"archive" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "demos_expires_at_idx" ON "demos" USING btree ("expires_at");