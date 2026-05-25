# ── Aurora Global Cluster ─────────────────────────────────────────────────────
#
# Aurora Global Database uses WAL streaming to replicate changes from the
# primary writer cluster (eu-west-1) to the secondary read-only cluster
# (eu-central-1) with typical replication lag < 1 second (RPO < 1s).
#
# On manual or automated failover:
#   1. Detach secondary cluster from global cluster
#   2. Secondary cluster is promoted to standalone writer
#   3. Route53 latency record for primary becomes unhealthy (HC fails at 3×10s)
#   4. DNS TTL 60s elapses → all traffic on api.yourgift.pt resolves to secondary ALB
#   Total RTO < 90 seconds

resource "aws_rds_global_cluster" "yourgift" {
  global_cluster_identifier = "${local.project}-global-${var.environment}"
  engine                    = "aurora-postgresql"
  engine_version            = "15.4"
  database_name             = "yourgift"
  storage_encrypted         = true
  deletion_protection       = true
}

# ── DB Subnet Groups ──────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "primary" {
  provider   = aws.primary
  name       = "${local.project}-primary-db-subnet-group"
  subnet_ids = aws_subnet.primary_private[*].id
  tags       = { Name = "${local.project}-primary-db-subnet-group" }
}

resource "aws_db_subnet_group" "secondary" {
  provider   = aws.secondary
  name       = "${local.project}-secondary-db-subnet-group"
  subnet_ids = aws_subnet.secondary_private[*].id
  tags       = { Name = "${local.project}-secondary-db-subnet-group" }
}

# ── Primary Aurora Cluster (eu-west-1 — writer) ───────────────────────────────

resource "aws_rds_cluster" "primary" {
  provider = aws.primary

  cluster_identifier        = "${local.project}-primary"
  engine                    = "aurora-postgresql"
  engine_version            = "15.4"
  global_cluster_identifier = aws_rds_global_cluster.yourgift.id
  database_name             = "yourgift"
  master_username           = var.db_username

  # Rotate master password automatically via Secrets Manager
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.primary.name
  vpc_security_group_ids = [aws_security_group.primary_rds.id]

  backup_retention_period      = 7
  preferred_backup_window      = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  storage_encrypted = true

  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${local.project}-primary-final-snapshot"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  apply_immediately = false

  tags = {
    Name   = "${local.project}-primary-cluster"
    Region = "primary"
    Role   = "writer"
  }

  lifecycle {
    ignore_changes = [replication_source_identifier]
  }
}

resource "aws_rds_cluster_instance" "primary" {
  provider = aws.primary
  count    = 2 # 1 writer + 1 reader in primary region for HA

  identifier         = "${local.project}-primary-${count.index}"
  cluster_identifier = aws_rds_cluster.primary.id
  engine             = aws_rds_cluster.primary.engine
  engine_version     = aws_rds_cluster.primary.engine_version
  instance_class     = var.db_instance_class

  db_subnet_group_name = aws_db_subnet_group.primary.name

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  auto_minor_version_upgrade = true

  tags = {
    Name   = "${local.project}-primary-instance-${count.index}"
    Region = "primary"
  }
}

# ── Secondary Aurora Cluster (eu-central-1 — read replica) ───────────────────

resource "aws_rds_cluster" "secondary" {
  provider = aws.secondary

  cluster_identifier        = "${local.project}-secondary"
  engine                    = "aurora-postgresql"
  engine_version            = "15.4"
  global_cluster_identifier = aws_rds_global_cluster.yourgift.id

  db_subnet_group_name   = aws_db_subnet_group.secondary.name
  vpc_security_group_ids = [aws_security_group.secondary_rds.id]

  backup_retention_period      = 7
  preferred_backup_window      = "02:00-03:00"
  preferred_maintenance_window = "sat:04:00-sat:05:00"

  storage_encrypted = true

  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${local.project}-secondary-final-snapshot"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  apply_immediately = false

  # Secondary clusters do not set master credentials — inherited from global cluster
  tags = {
    Name   = "${local.project}-secondary-cluster"
    Region = "secondary"
    Role   = "reader"
  }

  depends_on = [aws_rds_cluster.primary]

  lifecycle {
    ignore_changes = [replication_source_identifier]
  }
}

resource "aws_rds_cluster_instance" "secondary" {
  provider = aws.secondary
  count    = 1 # Hot standby — 1 reader; auto-failover promotes to writer

  identifier         = "${local.project}-secondary-${count.index}"
  cluster_identifier = aws_rds_cluster.secondary.id
  engine             = aws_rds_cluster.secondary.engine
  engine_version     = aws_rds_cluster.secondary.engine_version
  instance_class     = var.db_instance_class

  db_subnet_group_name = aws_db_subnet_group.secondary.name

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  auto_minor_version_upgrade = true

  tags = {
    Name   = "${local.project}-secondary-instance-${count.index}"
    Region = "secondary"
  }
}

# ── RDS Enhanced Monitoring Role ──────────────────────────────────────────────

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${local.project}-rds-enhanced-monitoring"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ── CloudWatch Alarms for Aurora ──────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "primary_db_cpu" {
  provider = aws.primary

  alarm_name          = "${local.project}-primary-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Primary Aurora CPU utilization > 80%"

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.primary.cluster_identifier
  }

  alarm_actions = [aws_sns_topic.failover_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "primary_db_replication_lag" {
  provider = aws.primary

  alarm_name          = "${local.project}-primary-db-replication-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "AuroraGlobalDBReplicationLag"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1000 # 1000ms replication lag SLA
  alarm_description   = "Aurora Global DB replication lag exceeds 1000ms — RPO degraded"

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.primary.cluster_identifier
  }

  alarm_actions = [aws_sns_topic.failover_alerts.arn]
}
