resource "aws_secretsmanager_secret" "db_url" {
  name                    = "${var.project_name}/database-url"
  recovery_window_in_days = 7
}

# DIRECT_URL is used by Prisma for direct (non-pooled) connections during migrations
resource "aws_secretsmanager_secret" "direct_url" {
  name                    = "${var.project_name}/direct-url"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.project_name}/jwt-secret"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "redis_url" {
  name                    = "${var.project_name}/redis-url"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "stripe_key" {
  name                    = "${var.project_name}/stripe-secret-key"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "stripe_webhook_secret" {
  name                    = "${var.project_name}/stripe-webhook-secret"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "midocean_api_key" {
  name                    = "${var.project_name}/midocean-api-key"
  recovery_window_in_days = 7
}
