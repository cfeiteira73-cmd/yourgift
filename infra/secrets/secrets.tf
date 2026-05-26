# ── API Secrets Bundle ────────────────────────────────────────────────────────
# All application secrets stored as a single JSON secret.
# Values are intentionally empty — fill them manually in the AWS Console
# or via: aws secretsmanager put-secret-value --secret-id yourgift/production/api --secret-string '{...}'
resource "aws_secretsmanager_secret" "api" {
  name        = "yourgift/${var.environment}/api"
  description = "YourGift API runtime secrets for ${var.environment}"

  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

resource "aws_secretsmanager_secret_version" "api_placeholder" {
  secret_id = aws_secretsmanager_secret.api.id

  # Placeholder JSON — replace values via Console or CLI before first deploy
  secret_string = jsonencode({
    DATABASE_URL            = ""
    JWT_SECRET              = ""
    STRIPE_KEY              = ""
    STRIPE_WEBHOOK_SECRET   = ""
    MIDOCEAN_KEY            = ""
    PF_CONCEPT_KEY          = ""
    S3_BUCKET               = ""
    CLOUDFRONT_URL          = ""
    RESEND_KEY              = ""
  })

  # Prevent Terraform from overwriting real values on subsequent applies
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── Variables ─────────────────────────────────────────────────────────────────
variable "environment" {
  type    = string
  default = "production"
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "api_secret_arn" {
  description = "ARN of the API secrets bundle"
  value       = aws_secretsmanager_secret.api.arn
}

output "api_secret_name" {
  value = aws_secretsmanager_secret.api.name
}
