# ── CloudWatch Log Group ──────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "yourgift-api-${var.environment}"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

# ── ECS Cluster ───────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "yourgift" {
  name = "yourgift-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

resource "aws_ecs_cluster_capacity_providers" "yourgift" {
  cluster_name       = aws_ecs_cluster.yourgift.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ── Security Group for API tasks ──────────────────────────────────────────────
resource "aws_security_group" "api" {
  name        = "yourgift-api-sg-${var.environment}"
  description = "Allow inbound from ALB only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "From ALB on API port"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "yourgift-api-sg"
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

# ── Task Definition ───────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "api" {
  family                   = "yourgift-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${var.api_image_url}:${var.api_image_tag}"
      essential = true

      portMappings = [
        { containerPort = 3001, protocol = "tcp" }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3001" }
      ]

      # All secrets are stored as a single JSON object in Secrets Manager.
      # ECS injects each key as an individual env var using the jsonKey syntax.
      secrets = [
        { name = "DATABASE_URL",          valueFrom = "${var.api_secret_arn}:DATABASE_URL::" },
        { name = "JWT_SECRET",            valueFrom = "${var.api_secret_arn}:JWT_SECRET::" },
        { name = "STRIPE_KEY",            valueFrom = "${var.api_secret_arn}:STRIPE_KEY::" },
        { name = "STRIPE_WEBHOOK_SECRET", valueFrom = "${var.api_secret_arn}:STRIPE_WEBHOOK_SECRET::" },
        { name = "MIDOCEAN_KEY",          valueFrom = "${var.api_secret_arn}:MIDOCEAN_KEY::" },
        { name = "PF_CONCEPT_KEY",        valueFrom = "${var.api_secret_arn}:PF_CONCEPT_KEY::" },
        { name = "S3_BUCKET",             valueFrom = "${var.api_secret_arn}:S3_BUCKET::" },
        { name = "CLOUDFRONT_URL",        valueFrom = "${var.api_secret_arn}:CLOUDFRONT_URL::" },
        { name = "RESEND_KEY",            valueFrom = "${var.api_secret_arn}:RESEND_KEY::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

# ── ECS Service ───────────────────────────────────────────────────────────────
resource "aws_ecs_service" "api" {
  name            = "yourgift-api"
  cluster         = aws_ecs_cluster.yourgift.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  # Allow Terraform to manage the task definition without replacing on every apply
  lifecycle {
    ignore_changes = [task_definition]
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = 3001
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  depends_on = [aws_cloudwatch_log_group.api]

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
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

variable "vpc_id" {
  description = "VPC ID from networking module"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs from networking module"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID of the ALB (for ingress rule)"
  type        = string
}

variable "target_group_arn" {
  description = "ALB target group ARN from alb module"
  type        = string
}

variable "ecs_execution_role_arn" {
  description = "ECS execution role ARN from iam module"
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ECS task role ARN from iam module"
  type        = string
}

variable "api_image_url" {
  description = "ECR repository URL from ecr module"
  type        = string
}

variable "api_image_tag" {
  description = "Image tag to deploy"
  type        = string
  default     = "latest"
}

variable "api_secret_arn" {
  description = "Secrets Manager secret ARN from secrets module"
  type        = string
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "cluster_name" {
  value = aws_ecs_cluster.yourgift.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.yourgift.arn
}

output "service_name" {
  value = aws_ecs_service.api.name
}
