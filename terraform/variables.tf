variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "yourgift"
}

variable "api_image" {
  description = "Docker image for the API (ECR URI)"
  type        = string
}

variable "domain_name" {
  description = "Main domain name"
  type        = string
  default     = "yourgift.pt"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "api_cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "ECS task memory (MB)"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "ECS desired task count"
  type        = number
  default     = 2
}

# ── pgBouncer / DB connection pool variables ───────────────────────────────────

variable "db_host" {
  description = "Postgres host (RDS endpoint) that pgBouncer connects to"
  type        = string
}

variable "db_name" {
  description = "Postgres database name that pgBouncer targets"
  type        = string
}

variable "db_username" {
  description = "Postgres superuser / application username for pgBouncer"
  type        = string
}

variable "db_secret_arn" {
  description = "ARN of the AWS Secrets Manager secret that contains the 'password' key for the DB user"
  type        = string
}
