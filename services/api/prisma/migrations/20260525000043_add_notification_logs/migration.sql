-- CreateTable: notification_logs (email audit trail)
-- Append-only — no updates, no deletes

CREATE TABLE "notification_logs" (
    "id"             TEXT NOT NULL,
    "to"             TEXT NOT NULL,
    "subject"        TEXT NOT NULL,
    "template"       TEXT,
    "status"         TEXT NOT NULL DEFAULT 'sent',
    "provider"       TEXT NOT NULL DEFAULT 'resend',
    "message_id"     TEXT,
    "error_message"  TEXT,
    "tenant_id"      TEXT,
    "reference_id"   TEXT,
    "reference_type" TEXT,
    "sent_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_to_idx"       ON "notification_logs"("to");
CREATE INDEX "notification_logs_status_idx"    ON "notification_logs"("status");
CREATE INDEX "notification_logs_template_idx"  ON "notification_logs"("template");
CREATE INDEX "notification_logs_tenant_idx"    ON "notification_logs"("tenant_id");
CREATE INDEX "notification_logs_sent_at_idx"   ON "notification_logs"("sent_at" DESC);
