# ── ElastiCache Redis — Primary Region (eu-west-1) ───────────────────────────
#
# Multi-AZ replication group with automatic failover.
# 3 cache clusters = 1 primary + 2 replicas spread across 3 AZs.
# On primary node failure: ElastiCache promotes a replica within ~30s.
#
# Cross-region note: ElastiCache does NOT natively support cross-region
# replication. The secondary region runs its own independent cluster.
# Cross-region state consistency is handled at the application layer:
#   - Session data: short TTL (15min) + re-auth on miss (acceptable UX)
#   - Rate limiting state: region-local (conservative — secondary starts fresh)
#   - BullMQ job queues: primary region authoritative; secondary drains its own queue

resource "aws_elasticache_subnet_group" "primary" {
  provider   = aws.primary
  name       = "${local.project}-primary-redis-subnet-group"
  subnet_ids = aws_subnet.primary_private[*].id
  tags       = { Name = "${local.project}-primary-redis-subnet-group" }
}

resource "aws_elasticache_parameter_group" "primary" {
  provider = aws.primary
  name     = "${local.project}-primary-redis7"
  family   = "redis7"

  # Enforce TLS-only, no plaintext connections
  parameter {
    name  = "tls-replication-mode"
    value = "required"
  }

  # Enable keyspace notifications for BullMQ job expiry events
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  # Slowlog threshold: log queries taking > 10ms
  parameter {
    name  = "slowlog-log-slower-than"
    value = "10000"
  }

  tags = { Name = "${local.project}-primary-redis-params" }
}

resource "aws_elasticache_replication_group" "primary" {
  provider = aws.primary

  replication_group_id = "${local.project}-primary-redis"
  description          = "YourGift primary Redis cluster — multi-AZ, automatic failover"

  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.primary.name
  engine_version       = "7.1"

  num_cache_clusters         = 3 # 1 primary + 2 replicas across 3 AZs
  automatic_failover_enabled = true
  multi_az_enabled           = true

  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  transit_encryption_mode     = "required"

  subnet_group_name  = aws_elasticache_subnet_group.primary.name
  security_group_ids = [aws_security_group.primary_redis.id]

  # Maintenance and backup windows (off-peak EU time)
  maintenance_window       = "sun:03:00-sun:04:00"
  snapshot_window          = "02:00-03:00"
  snapshot_retention_limit = 7

  apply_immediately = false

  # SNS notification for failover events
  notification_topic_arn = aws_sns_topic.redis_primary_failover.arn

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_primary_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_primary_engine.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = {
    Name   = "${local.project}-primary-redis"
    Region = "primary"
  }
}

resource "aws_cloudwatch_log_group" "redis_primary_slow" {
  provider          = aws.primary
  name              = "/elasticache/${local.project}-primary/slow-log"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "redis_primary_engine" {
  provider          = aws.primary
  name              = "/elasticache/${local.project}-primary/engine-log"
  retention_in_days = 14
}

resource "aws_sns_topic" "redis_primary_failover" {
  provider = aws.primary
  name     = "${local.project}-redis-primary-failover"
  tags     = { Name = "${local.project}-redis-primary-failover" }
}

# ── ElastiCache Redis — Secondary Region (eu-central-1) ──────────────────────

resource "aws_elasticache_subnet_group" "secondary" {
  provider   = aws.secondary
  name       = "${local.project}-secondary-redis-subnet-group"
  subnet_ids = aws_subnet.secondary_private[*].id
  tags       = { Name = "${local.project}-secondary-redis-subnet-group" }
}

resource "aws_elasticache_parameter_group" "secondary" {
  provider = aws.secondary
  name     = "${local.project}-secondary-redis7"
  family   = "redis7"

  parameter {
    name  = "tls-replication-mode"
    value = "required"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "slowlog-log-slower-than"
    value = "10000"
  }

  tags = { Name = "${local.project}-secondary-redis-params" }
}

resource "aws_elasticache_replication_group" "secondary" {
  provider = aws.secondary

  replication_group_id = "${local.project}-secondary-redis"
  description          = "YourGift secondary Redis cluster — multi-AZ, hot standby"

  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.secondary.name
  engine_version       = "7.1"

  num_cache_clusters         = 2 # 1 primary + 1 replica (cost-optimised standby)
  automatic_failover_enabled = true
  multi_az_enabled           = true

  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  transit_encryption_mode     = "required"

  subnet_group_name  = aws_elasticache_subnet_group.secondary.name
  security_group_ids = [aws_security_group.secondary_redis.id]

  maintenance_window       = "sun:03:00-sun:04:00"
  snapshot_window          = "02:00-03:00"
  snapshot_retention_limit = 7

  apply_immediately = false

  notification_topic_arn = aws_sns_topic.redis_secondary_failover.arn

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_secondary_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_secondary_engine.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = {
    Name   = "${local.project}-secondary-redis"
    Region = "secondary"
  }
}

resource "aws_cloudwatch_log_group" "redis_secondary_slow" {
  provider          = aws.secondary
  name              = "/elasticache/${local.project}-secondary/slow-log"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "redis_secondary_engine" {
  provider          = aws.secondary
  name              = "/elasticache/${local.project}-secondary/engine-log"
  retention_in_days = 14
}

resource "aws_sns_topic" "redis_secondary_failover" {
  provider = aws.secondary
  name     = "${local.project}-redis-secondary-failover"
  tags     = { Name = "${local.project}-redis-secondary-failover" }
}

# ── CloudWatch Alarms — Primary Redis ────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "redis_primary_replication_lag" {
  provider = aws.primary

  alarm_name          = "${local.project}-redis-primary-replication-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1000 # 1000ms replication lag SLA
  alarm_description   = "Redis primary replication lag exceeds 1000ms — replica is diverging"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.primary.replication_group_id
  }

  alarm_actions = [aws_sns_topic.redis_primary_failover.arn]
  ok_actions    = [aws_sns_topic.redis_primary_failover.arn]
}

resource "aws_cloudwatch_metric_alarm" "redis_primary_cpu" {
  provider = aws.primary

  alarm_name          = "${local.project}-redis-primary-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis primary engine CPU > 80%"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.primary.replication_group_id
  }

  alarm_actions = [aws_sns_topic.redis_primary_failover.arn]
}

resource "aws_cloudwatch_metric_alarm" "redis_primary_memory" {
  provider = aws.primary

  alarm_name          = "${local.project}-redis-primary-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "Redis primary memory usage > 75% — consider scaling node type"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.primary.replication_group_id
  }

  alarm_actions = [aws_sns_topic.redis_primary_failover.arn]
}

resource "aws_cloudwatch_metric_alarm" "redis_primary_connections" {
  provider = aws.primary

  alarm_name          = "${local.project}-redis-primary-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Maximum"
  threshold           = 5000
  alarm_description   = "Redis primary connection count exceeds 5000"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.primary.replication_group_id
  }

  alarm_actions = [aws_sns_topic.redis_primary_failover.arn]
}

# ── CloudWatch Alarms — Secondary Redis ──────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "redis_secondary_replication_lag" {
  provider = aws.secondary

  alarm_name          = "${local.project}-redis-secondary-replication-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ReplicationLag"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1000
  alarm_description   = "Redis secondary replication lag exceeds 1000ms"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.secondary.replication_group_id
  }

  alarm_actions = [aws_sns_topic.redis_secondary_failover.arn]
  ok_actions    = [aws_sns_topic.redis_secondary_failover.arn]
}

resource "aws_cloudwatch_metric_alarm" "redis_secondary_cpu" {
  provider = aws.secondary

  alarm_name          = "${local.project}-redis-secondary-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Redis secondary engine CPU > 80%"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.secondary.replication_group_id
  }

  alarm_actions = [aws_sns_topic.redis_secondary_failover.arn]
}
