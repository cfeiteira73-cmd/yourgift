resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "yourgift-assets-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = ["cdn.${var.domain}"]
  price_class         = "PriceClass_100"

  origin {
    domain_name              = var.s3_bucket_regional_domain_name
    origin_id                = "S3-yourgift-assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-yourgift-assets"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn != "" ? var.acm_certificate_arn : null
    cloudfront_default_certificate = var.acm_certificate_arn == ""
    ssl_support_method       = var.acm_certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version = var.acm_certificate_arn != "" ? "TLSv1.2_2021" : "TLSv1"
  }

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

variable "domain" {
  type    = string
  default = "yourgift.pt"
}

variable "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 assets bucket"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be in us-east-1)"
  type        = string
  default     = ""
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "distribution_domain" {
  value = aws_cloudfront_distribution.cdn.domain_name
}

output "distribution_id" {
  value = aws_cloudfront_distribution.cdn.id
}
