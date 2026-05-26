-- RefreshToken
CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_client_id_idx" ON "refresh_tokens"("client_id");

-- MagicLinkToken
CREATE TABLE "magic_link_tokens" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "magic_link_tokens_token_hash_key" ON "magic_link_tokens"("token_hash");
CREATE INDEX "magic_link_tokens_email_idx" ON "magic_link_tokens"("email");

-- OAuthAccount
CREATE TABLE "oauth_accounts" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_uid" TEXT NOT NULL,
  "email" TEXT,
  "display_name" TEXT,
  "avatar_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_accounts_provider_uid_key" ON "oauth_accounts"("provider", "provider_uid");
CREATE INDEX "oauth_accounts_client_id_idx" ON "oauth_accounts"("client_id");

-- AuthAuditLog
CREATE TABLE "auth_audit_logs" (
  "id" TEXT NOT NULL,
  "client_id" TEXT,
  "email" TEXT,
  "action" TEXT NOT NULL,
  "provider" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "error_msg" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auth_audit_logs_client_id_idx" ON "auth_audit_logs"("client_id");
CREATE INDEX "auth_audit_logs_created_at_idx" ON "auth_audit_logs"("created_at");
