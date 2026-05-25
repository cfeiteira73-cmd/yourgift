# ── ECS Clusters ──────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "primary" {
  provider = aws.primary
  name     = "${local.project}-primary-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${local.project}-primary-cluster" }
}

resource "aws_ecs_cluster_capacity_providers" "primary" {
  provider     = aws.primary
  cluster_name = aws_ecs_cluster.primary.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

resource "aws_ecs_cluster" "secondary" {
  provider = aws.secondary
  name     = "${local.project}-secondary-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${local.project}-secondary-cluster" }
}

resource "aws_ecs_cluster_capacity_providers" "secondary" {
  provider     = aws.secondary
  cluster_name = aws_ecs_cluster.secondary.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# ── IAM Roles ─────────────────────────────────────────────────────────────────

resource "aws_iam_role" "ecs_task_execution" {
  # IAM is global; created once, referenced in both regions
  name = "${local.project}-mr-ecs-task-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${local.project}-mr-execution-secrets"
  role = aws_iam_role.ecs_task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "kms:Decrypt"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.project}-mr-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_secrets" {
  name = "${local.project}-mr-task-secrets"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "ssm:GetParameters"
      ]
      Resource = "*"
    }]
  })
}

# ── CloudWatch Log Groups ─────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "api_primary" {
  provider          = aws.primary
  name              = "/ecs/${local.project}-primary-api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "api_secondary" {
  provider          = aws.secondary
  name              = "/ecs/${local.project}-secondary-api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "pgbouncer_primary" {
  provider          = aws.primary
  name              = "/ecs/${local.project}/primary/pgbouncer"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "pgbouncer_secondary" {
  provider          = aws.secondary
  name              = "/ecs/${local.project}/secondary/pgbouncer"
  retention_in_days = 30
}

# ── Task Definitions ──────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "api_primary" {
  provider                 = aws.primary
  family                   = "${local.project}-primary-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = var.api_image

      portMappings = [{
        containerPort = 3001
        protocol      = "tcp"
      }]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3001" },
        { name = "AWS_REGION", value = var.primary_region },
        { name = "REGION_ROLE", value = "primary" },
        { name = "S3_BUCKET", value = var.s3_assets_bucket_primary },
        { name = "CLOUDFRONT_DOMAIN", value = var.cloudfront_domain },
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = var.secrets_manager_db_url_arn_primary
        },
        {
          name      = "JWT_SECRET"
          valueFrom = var.secrets_manager_jwt_arn_primary
        },
        {
          name      = "STRIPE_SECRET_KEY"
          valueFrom = var.secrets_manager_stripe_arn_primary
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api_primary.name
          "awslogs-region"        = var.primary_region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:3001/api/v1/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    },

    # pgBouncer sidecar — connection pooler for Postgres (primary region)
    {
      name      = "pgbouncer"
      image     = "edoburu/pgbouncer:1.21.0"
      essential = false
      portMappings = [{ containerPort = 5432, hostPort = 0 }]

      environment = [
        { name = "DB_USER",             value = var.db_username },
        { name = "DB_HOST",             value = var.db_host_primary },
        { name = "DB_PORT",             value = "5432" },
        { name = "DB_NAME",             value = var.db_name },
        { name = "POOL_MODE",           value = "transaction" },
        { name = "MAX_CLIENT_CONN",     value = "1000" },
        { name = "DEFAULT_POOL_SIZE",   value = "25" },
        { name = "MIN_POOL_SIZE",       value = "5" },
        { name = "RESERVE_POOL_SIZE",   value = "5" },
        { name = "SERVER_IDLE_TIMEOUT", value = "600" },
        { name = "LOG_CONNECTIONS",     value = "0" },
        { name = "LOG_DISCONNECTIONS",  value = "0" },
        { name = "ADMIN_USERS",         value = "postgres" },
      ]

      secrets = [
        { name = "DB_PASSWORD", valueFrom = "${var.db_secret_arn_primary}:password::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.pgbouncer_primary.name
          "awslogs-region"        = var.primary_region
          "awslogs-stream-prefix" = "pgbouncer"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "pg_isready -h localhost -p 5432 -U $DB_USER || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }

      dependsOn = []
    }
  ])

  tags = { Region = "primary" }
}

resource "aws_ecs_task_definition" "api_secondary" {
  provider                 = aws.secondary
  family                   = "${local.project}-secondary-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = var.api_image

      portMappings = [{
        containerPort = 3001
        protocol      = "tcp"
      }]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3001" },
        { name = "AWS_REGION", value = var.secondary_region },
        { name = "REGION_ROLE", value = "secondary" },
        { name = "S3_BUCKET", value = var.s3_assets_bucket_primary },
        { name = "CLOUDFRONT_DOMAIN", value = var.cloudfront_domain },
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = var.secrets_manager_db_url_arn_secondary
        },
        {
          name      = "JWT_SECRET"
          valueFrom = var.secrets_manager_jwt_arn_secondary
        },
        {
          name      = "STRIPE_SECRET_KEY"
          valueFrom = var.secrets_manager_stripe_arn_secondary
        },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api_secondary.name
          "awslogs-region"        = var.secondary_region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:3001/api/v1/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    },

    # pgBouncer sidecar — connection pooler for Postgres (secondary region)
    {
      name      = "pgbouncer"
      image     = "edoburu/pgbouncer:1.21.0"
      essential = false
      portMappings = [{ containerPort = 5432, hostPort = 0 }]

      environment = [
        { name = "DB_USER",             value = var.db_username },
        { name = "DB_HOST",             value = var.db_host_secondary },
        { name = "DB_PORT",             value = "5432" },
        { name = "DB_NAME",             value = var.db_name },
        { name = "POOL_MODE",           value = "transaction" },
        { name = "MAX_CLIENT_CONN",     value = "1000" },
        { name = "DEFAULT_POOL_SIZE",   value = "25" },
        { name = "MIN_POOL_SIZE",       value = "5" },
        { name = "RESERVE_POOL_SIZE",   value = "5" },
        { name = "SERVER_IDLE_TIMEOUT", value = "600" },
        { name = "LOG_CONNECTIONS",     value = "0" },
        { name = "LOG_DISCONNECTIONS",  value = "0" },
        { name = "ADMIN_USERS",         value = "postgres" },
      ]

      secrets = [
        { name = "DB_PASSWORD", valueFrom = "${var.db_secret_arn_secondary}:password::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.pgbouncer_secondary.name
          "awslogs-region"        = var.secondary_region
          "awslogs-stream-prefix" = "pgbouncer"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "pg_isready -h localhost -p 5432 -U $DB_USER || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }

      dependsOn = []
    }
  ])

  tags = { Region = "secondary" }
}

# ── ALB — Primary ─────────────────────────────────────────────────────────────

resource "aws_alb" "primary" {
  provider                   = aws.primary
  name                       = "${local.project}-primary-alb"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.primary_alb.id]
  subnets                    = aws_subnet.primary_public[*].id
  enable_deletion_protection = true
  enable_http2               = true

  access_logs {
    bucket  = "${local.project}-alb-access-logs-primary"
    prefix  = "primary-alb"
    enabled = false # enable once log bucket is provisioned
  }

  tags = { Name = "${local.project}-primary-alb" }
}

resource "aws_alb_target_group" "api_primary" {
  provider     = aws.primary
  name         = "${local.project}-primary-api-tg"
  port         = 3001
  protocol     = "HTTP"
  vpc_id       = aws_vpc.primary.id
  target_type  = "ip"
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  stickiness {
    type    = "lb_cookie"
    enabled = false
  }

  tags = { Name = "${local.project}-primary-api-tg" }
}

resource "aws_alb_listener" "primary_http" {
  provider          = aws.primary
  load_balancer_arn = aws_alb.primary.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_alb_listener" "primary_https" {
  provider          = aws.primary
  load_balancer_arn = aws_alb.primary.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn_primary

  default_action {
    type             = "forward"
    target_group_arn = aws_alb_target_group.api_primary.arn
  }
}

# ── ALB — Secondary ───────────────────────────────────────────────────────────

resource "aws_alb" "secondary" {
  provider                   = aws.secondary
  name                       = "${local.project}-secondary-alb"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.secondary_alb.id]
  subnets                    = aws_subnet.secondary_public[*].id
  enable_deletion_protection = true
  enable_http2               = true

  tags = { Name = "${local.project}-secondary-alb" }
}

resource "aws_alb_target_group" "api_secondary" {
  provider     = aws.secondary
  name         = "${local.project}-secondary-api-tg"
  port         = 3001
  protocol     = "HTTP"
  vpc_id       = aws_vpc.secondary.id
  target_type  = "ip"
  deregistration_delay = 30

  health_check {
    enabled             = true
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = { Name = "${local.project}-secondary-api-tg" }
}

resource "aws_alb_listener" "secondary_http" {
  provider          = aws.secondary
  load_balancer_arn = aws_alb.secondary.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_alb_listener" "secondary_https" {
  provider          = aws.secondary
  load_balancer_arn = aws_alb.secondary.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn_secondary

  default_action {
    type             = "forward"
    target_group_arn = aws_alb_target_group.api_secondary.arn
  }
}

# ── ECS Services ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "api_primary" {
  provider        = aws.primary
  name            = "${local.project}-api"
  cluster         = aws_ecs_cluster.primary.id
  task_definition = aws_ecs_task_definition.api_primary.arn
  desired_count   = var.primary_desired_count
  launch_type     = "FARGATE"

  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = aws_subnet.primary_private[*].id
    security_groups  = [aws_security_group.primary_ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_alb_target_group.api_primary.arn
    container_name   = "api"
    container_port   = 3001
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_alb_listener.primary_https]

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  tags = { Region = "primary" }
}

resource "aws_ecs_service" "api_secondary" {
  provider        = aws.secondary
  name            = "${local.project}-api"
  cluster         = aws_ecs_cluster.secondary.id
  task_definition = aws_ecs_task_definition.api_secondary.arn
  # Hot standby: 1 task in steady state, auto-scales to max_capacity on failover
  desired_count = var.secondary_desired_count
  launch_type   = "FARGATE"

  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = aws_subnet.secondary_private[*].id
    security_groups  = [aws_security_group.secondary_ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_alb_target_group.api_secondary.arn
    container_name   = "api"
    container_port   = 3001
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_alb_listener.secondary_https]

  lifecycle {
    ignore_changes = [desired_count, task_definition]
  }

  tags = { Region = "secondary" }
}

# ── Auto Scaling — Primary ────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "api_primary" {
  provider           = aws.primary
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.primary.name}/${aws_ecs_service.api_primary.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_primary_cpu" {
  provider           = aws.primary
  name               = "${local.project}-primary-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api_primary.resource_id
  scalable_dimension = aws_appautoscaling_target.api_primary.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api_primary.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "api_primary_memory" {
  provider           = aws.primary
  name               = "${local.project}-primary-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api_primary.resource_id
  scalable_dimension = aws_appautoscaling_target.api_primary.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api_primary.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

# ── Auto Scaling — Secondary ──────────────────────────────────────────────────

resource "aws_appautoscaling_target" "api_secondary" {
  provider           = aws.secondary
  # On failover: Route53 health check removes primary, all traffic hits secondary.
  # min_capacity stays at 1 (hot standby), max_capacity mirrors primary for full takeover.
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.secondary.name}/${aws_ecs_service.api_secondary.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_secondary_cpu" {
  provider           = aws.secondary
  name               = "${local.project}-secondary-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api_secondary.resource_id
  scalable_dimension = aws_appautoscaling_target.api_secondary.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api_secondary.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 45 # Faster scale-out on secondary to absorb failover traffic quickly

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "api_secondary_memory" {
  provider           = aws.secondary
  name               = "${local.project}-secondary-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api_secondary.resource_id
  scalable_dimension = aws_appautoscaling_target.api_secondary.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api_secondary.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 45

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}
