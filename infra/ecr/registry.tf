# ── ECR Repository — yourgift-api ─────────────────────────────────────────────
resource "aws_ecr_repository" "api" {
  name                 = "yourgift-api"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

# ── Lifecycle policy: keep last 10 images ─────────────────────────────────────
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus   = "tagged"
          tagPrefixList = ["v", "sha"]
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Remove untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ── Variables ─────────────────────────────────────────────────────────────────
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "api_url" {
  description = "Full ECR repository URL for the API image"
  value       = aws_ecr_repository.api.repository_url
}

output "api_repository_name" {
  value = aws_ecr_repository.api.name
}
