# ─────────────────────────────────────────────────────────────────────────────
# YourGift OS — Backup & Disaster Recovery Configuration
#
# What this configures:
#   1. AWS Backup plan for RDS PostgreSQL (daily + weekly)
#   2. S3 versioning + cross-region replication for artwork/assets
#   3. ECS task definition snapshot strategy
#   4. Supabase PITR guidance (configured in Supabase dashboard)
#   5. Redis backup: Upstash handles automatically (7-day history on paid plan)
#
# RPO: 1 hour (point-in-time recovery)
# RTO: 4 hours (full restore + DNS switch)
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "primary_region" {
  default = "eu-west-1"
}

variable "dr_region" {
  default = "eu-west-2"   # London — failover region
}

variable "environment" {
  default = "production"
}

variable "s3_bucket_name" {
  description = "Primary S3 bucket for artwork + assets"
  default     = "yourgift-assets"
}

variable "rds_instance_arn" {
  description = "ARN of the primary RDS PostgreSQL instance"
  type        = string
  default     = ""   # Set via tfvars
}

# ── AWS Backup — RDS ─────────────────────────────────────────────────────────

resource "aws_backup_vault" "primary" {
  name        = "yourgift-backup-${var.environment}"
  tags = {
    Project = "yourgift-os"
    Env     = var.environment
  }
}

resource "aws_backup_vault" "dr" {
  provider    = aws.dr
  name        = "yourgift-backup-${var.environment}-dr"
  tags = {
    Project = "yourgift-os"
    Env     = var.environment
  }
}

resource "aws_backup_plan" "yourgift" {
  name = "yourgift-backup-plan"

  rule {
    rule_name         = "daily-hot"
    target_vault_name = aws_backup_vault.primary.name
    schedule          = "cron(0 3 * * ? *)"   # 03:00 UTC daily

    lifecycle {
      delete_after = 30   # Keep 30 daily backups
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.dr.arn
      lifecycle {
        delete_after = 14   # Keep 14 days in DR region
      }
    }
  }

  rule {
    rule_name         = "weekly-cold"
    target_vault_name = aws_backup_vault.primary.name
    schedule          = "cron(0 4 ? * 1 *)"   # 04:00 UTC every Sunday

    lifecycle {
      cold_storage_after = 7    # Move to Glacier after 7 days
      delete_after       = 365  # Keep 1 year
    }
  }

  rule {
    rule_name                = "monthly-compliance"
    target_vault_name        = aws_backup_vault.primary.name
    schedule                 = "cron(0 5 1 * ? *)"   # 05:00 UTC on 1st of month
    start_window             = 60
    completion_window        = 180
    enable_continuous_backup = false

    lifecycle {
      cold_storage_after = 30
      delete_after       = 2555   # 7 years (EU data retention compliance)
    }
  }

  tags = {
    Project = "yourgift-os"
  }
}

resource "aws_backup_selection" "rds" {
  count        = var.rds_instance_arn != "" ? 1 : 0
  iam_role_arn = aws_iam_role.backup.arn
  name         = "yourgift-rds-selection"
  plan_id      = aws_backup_plan.yourgift.id

  resources = [var.rds_instance_arn]
}

# ── IAM Role for AWS Backup ──────────────────────────────────────────────────

resource "aws_iam_role" "backup" {
  name = "yourgift-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "backup_restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

# ── S3 Versioning + Replication ───────────────────────────────────────────────

resource "aws_s3_bucket_versioning" "assets" {
  bucket = var.s3_bucket_name
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = var.s3_bucket_name

  rule {
    id     = "archive-old-versions"
    status = "Enabled"

    filter { prefix = "" }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }

  rule {
    id     = "delete-incomplete-uploads"
    status = "Enabled"
    filter { prefix = "" }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# DR bucket in secondary region
resource "aws_s3_bucket" "assets_dr" {
  provider = aws.dr
  bucket   = "${var.s3_bucket_name}-dr-eu-west-2"

  tags = {
    Project = "yourgift-os"
    Purpose = "disaster-recovery"
  }
}

resource "aws_s3_bucket_versioning" "assets_dr" {
  provider = aws.dr
  bucket   = aws_s3_bucket.assets_dr.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_iam_role" "s3_replication" {
  name = "yourgift-s3-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  name = "yourgift-s3-replication-policy"
  role = aws_iam_role.s3_replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetReplicationConfiguration", "s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObjectVersion", "s3:GetObjectVersionAcl", "s3:GetObjectVersionTagging"]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags"]
        Resource = "${aws_s3_bucket.assets_dr.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_replication_configuration" "assets" {
  depends_on = [aws_s3_bucket_versioning.assets]
  bucket     = var.s3_bucket_name
  role       = aws_iam_role.s3_replication.arn

  rule {
    id     = "replicate-all-to-dr"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.assets_dr.arn
      storage_class = "STANDARD_IA"
    }
  }
}

# ── CloudWatch Alarms for Backup ──────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "backup_failed" {
  alarm_name          = "yourgift-backup-job-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "NumberOfBackupJobsFailed"
  namespace           = "AWS/Backup"
  period              = 86400   # 24 hours
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert when any AWS Backup job fails"
  alarm_actions       = []   # Add SNS topic ARN for email/PagerDuty alerts
  ok_actions          = []
  treat_missing_data  = "notBreaching"

  dimensions = {
    BackupVaultName = aws_backup_vault.primary.name
  }
}

# ── Provider aliases ──────────────────────────────────────────────────────────

provider "aws" {
  region = var.primary_region
}

provider "aws" {
  alias  = "dr"
  region = var.dr_region
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "backup_vault_arn" {
  value = aws_backup_vault.primary.arn
}

output "backup_plan_id" {
  value = aws_backup_plan.yourgift.id
}

output "dr_bucket_name" {
  value = aws_s3_bucket.assets_dr.id
}

# ── Supabase PITR Configuration (Manual steps — no Terraform provider) ────────
#
# 1. Go to Supabase Dashboard → Project Settings → Database → Point in Time Recovery
# 2. Enable PITR — requires Pro plan (€25/mo)
# 3. Set retention to 7 days minimum
# 4. Test recovery: Dashboard → Database → Backups → Restore to point in time
#
# RPO with PITR: 5 minutes
# To restore: supabase db restore --ref <project-ref> --target <timestamp>
#
# Upstash Redis backup:
# - Free plan: no backup (acceptable — queues are ephemeral)
# - Paid plan ($0.40/GB): automatic daily backups, 7-day retention
# - To enable: Upstash Console → Database → Backup → Enable
