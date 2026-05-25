variable "environment" {
  description = "Deployment environment (production | staging)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "environment must be 'production' or 'staging'."
  }
}

variable "aws_region" {
  description = "AWS region where shadow-replay infrastructure is deployed"
  type        = string
  default     = "eu-west-1"
}

variable "staging_api_url" {
  description = "Base URL of the staging API that replayed traffic is forwarded to (e.g. https://staging-api.yourgift.pt)"
  type        = string
}

variable "staging_api_key" {
  description = "API key sent in x-api-key header when forwarding replayed requests to the staging API"
  type        = string
  sensitive   = true
}
