output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "api_url" {
  description = "API URL"
  value       = "https://api.${var.domain_name}"
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain"
  value       = aws_cloudfront_distribution.assets.domain_name
}

output "assets_url" {
  description = "Assets CDN URL"
  value       = "https://assets.${var.domain_name}"
}

output "s3_bucket_name" {
  description = "S3 assets bucket name"
  value       = aws_s3_bucket.assets.bucket
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.api.name
}

output "ecr_push_command" {
  description = "Example docker push command (replace ACCOUNT_ID)"
  value       = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "alerts_sns_arn" {
  description = "SNS topic ARN for CloudWatch alerts"
  value       = aws_sns_topic.alerts.arn
}
