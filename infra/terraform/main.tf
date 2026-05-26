terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "yourgift-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "eu-west-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Networking ────────────────────────────────────────────────────────────────
module "networking" {
  source = "../networking"

  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

# ── ECR ───────────────────────────────────────────────────────────────────────
module "ecr" {
  source = "../ecr"

  environment = var.environment
}

# ── IAM ───────────────────────────────────────────────────────────────────────
module "iam" {
  source = "../iam"

  environment  = var.environment
  aws_region   = var.aws_region
  github_org   = var.github_org
  github_repo  = var.github_repo
}

# ── ALB ───────────────────────────────────────────────────────────────────────
module "alb" {
  source = "../alb"

  environment         = var.environment
  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  acm_certificate_arn = var.acm_certificate_arn
}

# ── Secrets ───────────────────────────────────────────────────────────────────
module "secrets" {
  source = "../secrets"

  environment = var.environment
}

# ── ECS ───────────────────────────────────────────────────────────────────────
module "ecs" {
  source = "../ecs"

  environment            = var.environment
  aws_region             = var.aws_region
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  alb_security_group_id  = module.alb.alb_security_group_id
  target_group_arn       = module.alb.target_group_arn
  ecs_execution_role_arn = module.iam.ecs_execution_role_arn
  ecs_task_role_arn      = module.iam.ecs_task_role_arn
  api_image_url          = module.ecr.api_url
  api_image_tag          = var.api_image_tag
  api_secret_arn         = module.secrets.api_secret_arn
}

# ── RDS ───────────────────────────────────────────────────────────────────────
module "rds" {
  source = "../rds"

  environment        = var.environment
  private_subnet_ids = module.networking.private_subnet_ids
  vpc_id             = module.networking.vpc_id
  db_password        = var.db_password
  db_instance_class  = var.db_instance_class
  db_name            = var.db_name
}

# ── S3 ────────────────────────────────────────────────────────────────────────
module "s3" {
  source = "../s3"

  environment = var.environment
}

# ── CloudFront ────────────────────────────────────────────────────────────────
module "cloudfront" {
  source = "../cloudfront"

  environment                    = var.environment
  domain                         = var.domain_name
  s3_bucket_regional_domain_name = module.s3.bucket_regional_domain_name
  acm_certificate_arn            = var.acm_certificate_arn
}
