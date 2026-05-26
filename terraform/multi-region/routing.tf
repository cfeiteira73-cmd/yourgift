# ── Route53 Zone ──────────────────────────────────────────────────────────────

data "aws_route53_zone" "main" {
  # Route53 hosted zones are global; reference from any provider
  name         = var.domain_name
  private_zone = false
}

# ── Route53 Health Checks ─────────────────────────────────────────────────────

resource "aws_route53_health_check" "primary_api" {
  fqdn              = aws_alb.primary.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  failure_threshold = 3
  request_interval  = 10 # Fast interval: failure detected in 30s (3 × 10s)

  enable_sni = true

  tags = {
    Name   = "${local.project}-primary-hc"
    Region = "eu-west-1"
  }
}

resource "aws_route53_health_check" "secondary_api" {
  fqdn              = aws_alb.secondary.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  failure_threshold = 3
  request_interval  = 10

  enable_sni = true

  tags = {
    Name   = "${local.project}-secondary-hc"
    Region = "eu-central-1"
  }
}

# ── Route53 Latency-Based Routing Records ─────────────────────────────────────

resource "aws_route53_record" "api_primary" {
  zone_id        = data.aws_route53_zone.main.zone_id
  name           = "api.${var.domain_name}"
  type           = "A"
  set_identifier = "primary"

  latency_routing_policy {
    region = var.primary_region
  }

  health_check_id = aws_route53_health_check.primary_api.id

  alias {
    name                   = aws_alb.primary.dns_name
    zone_id                = aws_alb.primary.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_secondary" {
  zone_id        = data.aws_route53_zone.main.zone_id
  name           = "api.${var.domain_name}"
  type           = "A"
  set_identifier = "secondary"

  latency_routing_policy {
    region = var.secondary_region
  }

  health_check_id = aws_route53_health_check.secondary_api.id

  alias {
    name                   = aws_alb.secondary.dns_name
    zone_id                = aws_alb.secondary.zone_id
    evaluate_target_health = true
  }
}

# ── Route53 AAAA (IPv6) Latency Records ───────────────────────────────────────

resource "aws_route53_record" "api_primary_ipv6" {
  zone_id        = data.aws_route53_zone.main.zone_id
  name           = "api.${var.domain_name}"
  type           = "AAAA"
  set_identifier = "primary-ipv6"

  latency_routing_policy {
    region = var.primary_region
  }

  health_check_id = aws_route53_health_check.primary_api.id

  alias {
    name                   = aws_alb.primary.dns_name
    zone_id                = aws_alb.primary.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_secondary_ipv6" {
  zone_id        = data.aws_route53_zone.main.zone_id
  name           = "api.${var.domain_name}"
  type           = "AAAA"
  set_identifier = "secondary-ipv6"

  latency_routing_policy {
    region = var.secondary_region
  }

  health_check_id = aws_route53_health_check.secondary_api.id

  alias {
    name                   = aws_alb.secondary.dns_name
    zone_id                = aws_alb.secondary.zone_id
    evaluate_target_health = true
  }
}

# ── Global Accelerator ────────────────────────────────────────────────────────

resource "aws_globalaccelerator_accelerator" "main" {
  name            = "${local.project}-global-accelerator"
  ip_address_type = "DUAL_STACK" # IPv4 + IPv6
  enabled         = true

  attributes {
    flow_logs_enabled   = true
    flow_logs_s3_bucket = var.global_accelerator_flow_logs_bucket
    flow_logs_s3_prefix = "ga-flow-logs/"
  }

  tags = {
    Name        = "${local.project}-global-accelerator"
    Description = "Global Accelerator for multi-region active-active deployment"
  }
}

resource "aws_globalaccelerator_listener" "api_https" {
  accelerator_arn = aws_globalaccelerator_accelerator.main.id
  client_affinity = "NONE" # Stateless API; no session pinning required
  protocol        = "TCP"

  port_range {
    from_port = 443
    to_port   = 443
  }
}

resource "aws_globalaccelerator_listener" "api_http_redirect" {
  accelerator_arn = aws_globalaccelerator_accelerator.main.id
  client_affinity = "NONE"
  protocol        = "TCP"

  port_range {
    from_port = 80
    to_port   = 80
  }
}

# Endpoint group — primary region (eu-west-1)
resource "aws_globalaccelerator_endpoint_group" "primary" {
  listener_arn                  = aws_globalaccelerator_listener.api_https.id
  endpoint_group_region         = var.primary_region
  traffic_dial_percentage       = 100 # Receives full traffic share under normal operation
  health_check_path             = var.health_check_path
  health_check_port             = 443
  health_check_protocol         = "HTTPS"
  health_check_interval_seconds = 10
  threshold_count               = 3

  endpoint_configuration {
    endpoint_id                    = aws_alb.primary.arn
    weight                         = 255 # Max weight — primary takes all EU-West traffic
    client_ip_preservation_enabled = true
  }
}

# Endpoint group — secondary region (eu-central-1)
resource "aws_globalaccelerator_endpoint_group" "secondary" {
  listener_arn                  = aws_globalaccelerator_listener.api_https.id
  endpoint_group_region         = var.secondary_region
  traffic_dial_percentage       = 100
  health_check_path             = var.health_check_path
  health_check_port             = 443
  health_check_protocol         = "HTTPS"
  health_check_interval_seconds = 10
  threshold_count               = 3

  endpoint_configuration {
    endpoint_id                    = aws_alb.secondary.arn
    weight                         = 128 # Lower weight — only receives traffic when primary is unhealthy or for nearby users
    client_ip_preservation_enabled = true
  }
}

# Endpoint groups for the HTTP redirect listener (mirrors HTTPS setup)
resource "aws_globalaccelerator_endpoint_group" "primary_http" {
  listener_arn                  = aws_globalaccelerator_listener.api_http_redirect.id
  endpoint_group_region         = var.primary_region
  traffic_dial_percentage       = 100
  health_check_path             = var.health_check_path
  health_check_port             = 443
  health_check_protocol         = "HTTPS"
  health_check_interval_seconds = 10
  threshold_count               = 3

  endpoint_configuration {
    endpoint_id                    = aws_alb.primary.arn
    weight                         = 255
    client_ip_preservation_enabled = true
  }
}

resource "aws_globalaccelerator_endpoint_group" "secondary_http" {
  listener_arn                  = aws_globalaccelerator_listener.api_http_redirect.id
  endpoint_group_region         = var.secondary_region
  traffic_dial_percentage       = 100
  health_check_path             = var.health_check_path
  health_check_port             = 443
  health_check_protocol         = "HTTPS"
  health_check_interval_seconds = 10
  threshold_count               = 3

  endpoint_configuration {
    endpoint_id                    = aws_alb.secondary.arn
    weight                         = 128
    client_ip_preservation_enabled = true
  }
}

# ── Route53 record for Global Accelerator CNAME ───────────────────────────────

resource "aws_route53_record" "global_accelerator" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "ga.${var.domain_name}"
  type    = "CNAME"
  ttl     = 60
  records = [aws_globalaccelerator_accelerator.main.dns_name]
}

# ── CloudWatch Alarms for Route53 Health Checks ───────────────────────────────

resource "aws_cloudwatch_metric_alarm" "primary_health_check_failed" {
  alarm_name          = "${local.project}-primary-health-check-failed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 30
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "Primary region health check failed — failover to secondary is active"
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.primary_api.id
  }

  alarm_actions = [aws_sns_topic.failover_alerts.arn]
  ok_actions    = [aws_sns_topic.failover_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "secondary_health_check_failed" {
  alarm_name          = "${local.project}-secondary-health-check-failed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 30
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "Secondary region health check failed — both regions are degraded"
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.secondary_api.id
  }

  alarm_actions = [aws_sns_topic.failover_alerts.arn]
  ok_actions    = [aws_sns_topic.failover_alerts.arn]
}

resource "aws_sns_topic" "failover_alerts" {
  name = "${local.project}-failover-alerts"
  tags = { Name = "${local.project}-failover-alerts" }
}
