# ── ALB DNS Names ─────────────────────────────────────────────────────────────

output "primary_alb_dns" {
  description = "DNS name of the primary region Application Load Balancer (eu-west-1)"
  value       = aws_alb.primary.dns_name
}

output "secondary_alb_dns" {
  description = "DNS name of the secondary region Application Load Balancer (eu-central-1)"
  value       = aws_alb.secondary.dns_name
}

output "primary_alb_arn" {
  description = "ARN of the primary region ALB"
  value       = aws_alb.primary.arn
}

output "secondary_alb_arn" {
  description = "ARN of the secondary region ALB"
  value       = aws_alb.secondary.arn
}

# ── Global Accelerator ────────────────────────────────────────────────────────

output "global_accelerator_dns" {
  description = "AWS-assigned DNS name for the Global Accelerator (use this in CNAME or as entry point)"
  value       = aws_globalaccelerator_accelerator.main.dns_name
}

output "global_accelerator_ips" {
  description = "Static anycast IP addresses assigned to the Global Accelerator (IPv4 + IPv6 pairs)"
  value       = aws_globalaccelerator_accelerator.main.ip_sets
}

output "global_accelerator_arn" {
  description = "ARN of the Global Accelerator"
  value       = aws_globalaccelerator_accelerator.main.id
}

# ── Aurora Database ───────────────────────────────────────────────────────────

output "primary_cluster_endpoint" {
  description = "Primary Aurora cluster writer endpoint (eu-west-1). Use for all write operations."
  value       = aws_rds_cluster.primary.endpoint
  sensitive   = true
}

output "primary_cluster_reader_endpoint" {
  description = "Primary Aurora cluster reader endpoint (eu-west-1). Use for read-heavy queries."
  value       = aws_rds_cluster.primary.reader_endpoint
  sensitive   = true
}

output "secondary_cluster_endpoint" {
  description = "Secondary Aurora cluster endpoint (eu-central-1). Read-only under normal operation; becomes writer after failover."
  value       = aws_rds_cluster.secondary.endpoint
  sensitive   = true
}

output "global_cluster_identifier" {
  description = "Aurora Global Database cluster identifier"
  value       = aws_rds_global_cluster.yourgift.global_cluster_identifier
}

# ── Redis ─────────────────────────────────────────────────────────────────────

output "primary_redis_primary_endpoint" {
  description = "Primary Redis cluster primary endpoint (eu-west-1)"
  value       = aws_elasticache_replication_group.primary.primary_endpoint_address
  sensitive   = true
}

output "primary_redis_reader_endpoint" {
  description = "Primary Redis cluster reader endpoint (eu-west-1)"
  value       = aws_elasticache_replication_group.primary.reader_endpoint_address
  sensitive   = true
}

output "secondary_redis_primary_endpoint" {
  description = "Secondary Redis cluster primary endpoint (eu-central-1)"
  value       = aws_elasticache_replication_group.secondary.primary_endpoint_address
  sensitive   = true
}

output "secondary_redis_reader_endpoint" {
  description = "Secondary Redis cluster reader endpoint (eu-central-1)"
  value       = aws_elasticache_replication_group.secondary.reader_endpoint_address
  sensitive   = true
}

# ── ECS ───────────────────────────────────────────────────────────────────────

output "primary_ecs_cluster_name" {
  description = "Primary ECS cluster name"
  value       = aws_ecs_cluster.primary.name
}

output "secondary_ecs_cluster_name" {
  description = "Secondary ECS cluster name"
  value       = aws_ecs_cluster.secondary.name
}

output "primary_ecs_service_name" {
  description = "Primary ECS service name"
  value       = aws_ecs_service.api_primary.name
}

output "secondary_ecs_service_name" {
  description = "Secondary ECS service name"
  value       = aws_ecs_service.api_secondary.name
}

# ── Route53 Health Checks ─────────────────────────────────────────────────────

output "primary_health_check_id" {
  description = "Route53 health check ID for the primary region"
  value       = aws_route53_health_check.primary_api.id
}

output "secondary_health_check_id" {
  description = "Route53 health check ID for the secondary region"
  value       = aws_route53_health_check.secondary_api.id
}

# ── Failover Alerts ───────────────────────────────────────────────────────────

output "failover_sns_topic_arn" {
  description = "SNS topic ARN for failover and health check alerts"
  value       = aws_sns_topic.failover_alerts.arn
}

output "redis_primary_failover_sns_arn" {
  description = "SNS topic ARN for primary Redis failover events"
  value       = aws_sns_topic.redis_primary_failover.arn
}

output "redis_secondary_failover_sns_arn" {
  description = "SNS topic ARN for secondary Redis failover events"
  value       = aws_sns_topic.redis_secondary_failover.arn
}

# ── Networking ────────────────────────────────────────────────────────────────

output "primary_vpc_id" {
  description = "Primary region VPC ID"
  value       = aws_vpc.primary.id
}

output "secondary_vpc_id" {
  description = "Secondary region VPC ID"
  value       = aws_vpc.secondary.id
}

output "primary_private_subnet_ids" {
  description = "Private subnet IDs in the primary region"
  value       = aws_subnet.primary_private[*].id
}

output "secondary_private_subnet_ids" {
  description = "Private subnet IDs in the secondary region"
  value       = aws_subnet.secondary_private[*].id
}

# ── Summary ───────────────────────────────────────────────────────────────────

output "deployment_summary" {
  description = "Human-readable summary of the multi-region deployment"
  value = {
    primary_region         = var.primary_region
    secondary_region       = var.secondary_region
    api_endpoint           = "https://api.${var.domain_name}"
    global_accelerator_url = "https://ga.${var.domain_name}"
    failover_rto_seconds   = 90
    replication_rpo_ms     = 1000
    environment            = var.environment
  }
}
