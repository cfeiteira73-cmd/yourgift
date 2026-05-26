data "aws_caller_identity" "current" {}

# ── ECS Execution Role ────────────────────────────────────────────────────────
# Used by the ECS agent to pull images from ECR and fetch secrets.
resource "aws_iam_role" "ecs_execution" {
  name = "yourgift-ecs-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "yourgift-ecs-secrets-access"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:yourgift/*"
      }
    ]
  })
}

# ── ECS Task Role ─────────────────────────────────────────────────────────────
# Permissions assumed by the running container itself.
resource "aws_iam_role" "ecs_task" {
  name = "yourgift-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "yourgift-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::yourgift-assets-*",
          "arn:aws:s3:::yourgift-assets-*/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_task_cloudwatch" {
  name = "yourgift-ecs-task-cloudwatch"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/yourgift-*"
      }
    ]
  })
}

# ── GitHub Actions Deployment Role (OIDC) ────────────────────────────────────
# Allows GitHub Actions to deploy without long-lived access keys.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "yourgift-github-actions-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
        }
      }
    }]
  })

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

resource "aws_iam_role_policy_attachment" "github_ecs" {
  role       = aws_iam_role.github_actions_deploy.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
}

resource "aws_iam_role_policy" "github_ecr_push" {
  name = "yourgift-github-ecr-push"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/yourgift-*"
      }
    ]
  })
}

# ── Variables ─────────────────────────────────────────────────────────────────
variable "environment" {
  type    = string
  default = "production"
}

variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "github_org" {
  type    = string
  default = "yourgift-pt"
}

variable "github_repo" {
  type    = string
  default = "yourgift-os"
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task.arn
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions_deploy.arn
}
