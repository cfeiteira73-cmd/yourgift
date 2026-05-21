variable "env" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

# Keep backward-compatible alias used by existing resources
variable "environment" {
  description = "Alias for env — used by legacy resources"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-west-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the main VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of AZs to use for subnets"
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b"]
}

variable "api_image_tag" {
  description = "Docker image tag for the API service"
  type        = string
  default     = "latest"
}

variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
  default     = "yourgift.pt"
}

# Keep backward-compatible alias used by CloudFront module
variable "domain" {
  description = "Alias for domain_name — used by legacy resources"
  type        = string
  default     = "yourgift.pt"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "yourgift"
}

variable "db_password" {
  description = "Master password for the RDS instance"
  type        = string
  sensitive   = true
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS (must be in us-east-1 for CloudFront, eu-west-1 for ALB)"
  type        = string
  default     = ""
}

variable "github_org" {
  description = "GitHub organisation or username for the OIDC trust policy"
  type        = string
  default     = "yourgift-pt"
}

variable "github_repo" {
  description = "GitHub repository name for the OIDC trust policy"
  type        = string
  default     = "yourgift-os"
}
