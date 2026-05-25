-- Migration: add MFA fields to admin_users (SOC2 CC6.3 - MFA enforcement)

ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "mfa_secret"      TEXT;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "mfa_enabled"     BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "mfa_verified_at" TIMESTAMPTZ;
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "mfa_backup_codes" TEXT[]      NOT NULL DEFAULT '{}';
