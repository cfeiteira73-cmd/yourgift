terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "yourgift-terraform-state"
    key            = "production/multi-region/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "yourgift-terraform-locks"
    encrypt        = true
  }
}

# Primary region provider (EU West 1 — Ireland)
provider "aws" {
  alias  = "primary"
  region = "eu-west-1"
  default_tags {
    tags = local.common_tags
  }
}

# Secondary region provider (EU Central 1 — Frankfurt)
provider "aws" {
  alias  = "secondary"
  region = "eu-central-1"
  default_tags {
    tags = local.common_tags
  }
}

# Global provider for IAM, Route53, Global Accelerator, ACM (us-east-1 required)
provider "aws" {
  alias  = "global"
  region = "us-east-1"
  default_tags {
    tags = local.common_tags
  }
}

locals {
  project     = "yourgift"
  environment = var.environment
  common_tags = {
    Project     = local.project
    Environment = local.environment
    ManagedBy   = "terraform"
    MultiRegion = "true"
  }
}

# ── Data Sources ──────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {
  provider = aws.primary
}

data "aws_availability_zones" "primary" {
  provider = aws.primary
  state    = "available"
}

data "aws_availability_zones" "secondary" {
  provider = aws.secondary
  state    = "available"
}
