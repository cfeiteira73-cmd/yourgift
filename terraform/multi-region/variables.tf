variable "environment" {
  description = "Deployment environment (production | staging)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "environment must be 'production' or 'staging'."
  }
}

variable "primary_region" {
  description = "AWS primary region identifier"
  type        = string
  default     = "eu-west-1"
}

variable "secondary_region" {
  description = "AWS secondary (hot-standby) region identifier"
  type        = string
  default     = "eu-central-1"
}

variable "api_image" {
  description = "Docker image URI for the API service (ECR URI with tag)"
  type        = string
  # Example: 123456789012.dkr.ecr.eu-west-1.amazonaws.com/yourgift-api:latest
}

variable "web_image" {
  description = "Docker image URI for the web frontend service (ECR URI with tag)"
  type        = string
}

variable "admin_image" {
  description = "Docker image URI for the admin panel service (ECR URI with tag)"
  type        = string
}

variable "db_instance_class" {
  description = "Aurora PostgreSQL instance class"
  type        = string
  default     = "db.r6g.large"

  validation {
    condition     = can(regex("^db\\.(r|t)", var.db_instance_class))
    error_message = "db_instance_class must be a valid Aurora-compatible instance class."
  }
}

variable "db_username" {
  description = "Aurora cluster master username"
  type        = string
  default     = "yourgift"
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "domain_name" {
  description = "Primary domain name (e.g. yourgift.pt)"
  type        = string
  default     = "yourgift.pt"
}

variable "health_check_path" {
  description = "HTTP path used by Route53 health checks and ALB health checks"
  type        = string
  default     = "/api/v1/health"
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks per service per region"
  type        = number
  default     = 1

  validation {
    condition     = var.min_capacity >= 1
    error_message = "min_capacity must be at least 1."
  }
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks per service per region"
  type        = number
  default     = 20

  validation {
    condition     = var.max_capacity >= 2
    error_message = "max_capacity must be at least 2."
  }
}

variable "api_cpu" {
  description = "Fargate task CPU units (256 | 512 | 1024 | 2048 | 4096)"
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 2048
}

variable "primary_desired_count" {
  description = "Desired ECS task count in the primary region"
  type        = number
  default     = 2
}

variable "secondary_desired_count" {
  description = "Desired ECS task count in the secondary region (hot standby; auto-scales on failover)"
  type        = number
  default     = 1
}

variable "acm_certificate_arn_primary" {
  description = "ACM certificate ARN for the primary region ALB (must cover api.domain_name)"
  type        = string
}

variable "acm_certificate_arn_secondary" {
  description = "ACM certificate ARN for the secondary region ALB (must cover api.domain_name)"
  type        = string
}

variable "secrets_manager_db_url_arn_primary" {
  description = "Secrets Manager ARN for DATABASE_URL in primary region"
  type        = string
}

variable "secrets_manager_db_url_arn_secondary" {
  description = "Secrets Manager ARN for DATABASE_URL in secondary region (points to read replica)"
  type        = string
}

variable "secrets_manager_jwt_arn_primary" {
  description = "Secrets Manager ARN for JWT_SECRET in primary region"
  type        = string
}

variable "secrets_manager_jwt_arn_secondary" {
  description = "Secrets Manager ARN for JWT_SECRET in secondary region"
  type        = string
}

variable "secrets_manager_stripe_arn_primary" {
  description = "Secrets Manager ARN for STRIPE_SECRET_KEY in primary region"
  type        = string
}

variable "secrets_manager_stripe_arn_secondary" {
  description = "Secrets Manager ARN for STRIPE_SECRET_KEY in secondary region"
  type        = string
}

variable "s3_assets_bucket_primary" {
  description = "S3 assets bucket name in primary region"
  type        = string
}

variable "cloudfront_domain" {
  description = "CloudFront distribution domain name for assets"
  type        = string
}

variable "global_accelerator_flow_logs_bucket" {
  description = "S3 bucket name for Global Accelerator flow logs"
  type        = string
  default     = "yourgift-ga-flow-logs"
}

# ── pgBouncer / DB connection pool variables ───────────────────────────────────

variable "db_host_primary" {
  description = "Postgres host (Aurora primary writer endpoint) that pgBouncer connects to in the primary region"
  type        = string
}

variable "db_host_secondary" {
  description = "Postgres host (Aurora secondary reader/writer endpoint) that pgBouncer connects to in the secondary region"
  type        = string
}

variable "db_name" {
  description = "Postgres database name that pgBouncer targets in both regions"
  type        = string
}

variable "db_secret_arn_primary" {
  description = "ARN of the Secrets Manager secret containing the 'password' key for the DB user in the primary region"
  type        = string
}

variable "db_secret_arn_secondary" {
  description = "ARN of the Secrets Manager secret containing the 'password' key for the DB user in the secondary region"
  type        = string
}
