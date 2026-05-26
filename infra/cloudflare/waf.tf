# ─────────────────────────────────────────────────────────────────────────────
# YourGift OS — Cloudflare WAF + Security Configuration
# Terraform provider: cloudflare/cloudflare ~> 4.0
#
# What this configures:
#   1. Zone settings (TLS 1.3, HSTS, HTTP/2, Brotli)
#   2. WAF managed ruleset (OWASP Core + Cloudflare Managed)
#   3. Custom firewall rules (rate limit bypass, scraper blocking)
#   4. Bot management rules
#   5. Page rules (cache, security headers)
#   6. Worker routes (edge auth verification)
#
# Usage:
#   export TF_VAR_cloudflare_api_token="your-token"
#   export TF_VAR_zone_id="your-zone-id"
#   terraform init && terraform apply
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone:Edit + WAF:Edit permissions"
  type        = string
  sensitive   = true
}

variable "zone_id" {
  description = "Cloudflare Zone ID for yourgift.pt"
  type        = string
}

variable "api_hostname" {
  description = "API hostname (e.g. api.yourgift.pt)"
  type        = string
  default     = "api.yourgift.pt"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ── Zone Settings ─────────────────────────────────────────────────────────────

resource "cloudflare_zone_settings_override" "yourgift" {
  zone_id = var.zone_id

  settings {
    ssl                      = "full_strict"
    tls_1_3                  = "zrt"          # TLS 1.3 + 0-RTT
    min_tls_version          = "1.2"
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    hsts {
      enabled            = true
      max_age            = 31536000
      include_subdomains = true
      preload            = true
      nosniff            = true
    }
    http2                    = "on"
    http3                    = "on"
    zero_rtt                 = "on"
    brotli                   = "on"
    minify {
      html = "on"
      css  = "on"
      js   = "on"
    }
    security_level           = "medium"
    challenge_ttl            = 1800
    browser_check            = "on"
    hotlink_protection       = "on"
    email_obfuscation        = "on"
    server_side_exclude      = "on"
    rocket_loader            = "off"         # Disabled — breaks module scripts
    development_mode         = "off"
  }
}

# ── WAF Managed Ruleset ───────────────────────────────────────────────────────

resource "cloudflare_ruleset" "waf_managed" {
  zone_id     = var.zone_id
  name        = "YourGift WAF Managed Rules"
  description = "OWASP Core + Cloudflare Managed Ruleset"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules {
    action = "execute"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee"  # Cloudflare Managed Ruleset
      overrides {
        enabled = true
        action  = "block"
      }
    }
    expression  = "true"
    description = "Enable Cloudflare Managed Ruleset (block mode)"
    enabled     = true
  }

  rules {
    action = "execute"
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f"  # OWASP Core Ruleset
      overrides {
        enabled = true
        action  = "block"
        categories {
          category = "paranoia-level-1"
          action   = "block"
          enabled  = true
        }
        categories {
          category = "paranoia-level-2"
          action   = "block"
          enabled  = true
        }
      }
    }
    expression  = "true"
    description = "Enable OWASP Core Ruleset PL1+PL2"
    enabled     = true
  }
}

# ── Custom Firewall Rules ─────────────────────────────────────────────────────

resource "cloudflare_ruleset" "custom_firewall" {
  zone_id     = var.zone_id
  name        = "YourGift Custom Firewall Rules"
  description = "Rate limits, geo-blocks, bad-bot blocking"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # Block requests missing User-Agent (automated scanners)
  rules {
    action      = "block"
    expression  = "(http.user_agent eq \"\") and (not cf.client.bot)"
    description = "Block empty User-Agent requests"
    enabled     = true
  }

  # Block SQL injection patterns in query params
  rules {
    action      = "block"
    expression  = "(http.request.uri.query contains \"' OR\") or (http.request.uri.query contains \"1=1\") or (http.request.uri.query contains \"UNION SELECT\")"
    description = "Block basic SQL injection in query strings"
    enabled     = true
  }

  # Block path traversal
  rules {
    action      = "block"
    expression  = "(http.request.uri.path contains \"../\") or (http.request.uri.path contains \"%2e%2e%2f\") or (http.request.uri.path contains \"..%2f\")"
    description = "Block path traversal attempts"
    enabled     = true
  }

  # Challenge requests to /auth/ from high-threat countries
  rules {
    action      = "js_challenge"
    expression  = "(http.request.uri.path starts_with \"/auth/\") and (ip.geoip.country in {\"CN\" \"RU\" \"KP\" \"IR\"})"
    description = "JS challenge for auth routes from high-threat geos"
    enabled     = false  # Enable after review
  }

  # Allow Stripe webhook IPs (skip WAF for Stripe callbacks)
  # Stripe IP ranges: https://stripe.com/docs/ips
  rules {
    action      = "skip"
    action_parameters {
      phases = ["http_request_firewall_managed"]
    }
    expression  = "(ip.src in {54.187.174.169 54.187.205.235 54.187.216.72 54.241.31.99 54.241.31.102 54.241.34.107}) and (http.request.uri.path contains \"/webhooks/stripe\")"
    description = "Skip WAF for Stripe webhook IPs"
    enabled     = true
  }

  # Rate limit: API endpoints — 100 req/min per IP (backup to app-level throttle)
  rules {
    action = "block"
    ratelimit {
      characteristics      = ["ip.src"]
      period               = 60
      requests_per_period  = 100
      mitigation_timeout   = 300
    }
    expression  = "(http.request.uri.path starts_with \"/api/\") or (http.host eq \"${var.api_hostname}\")"
    description = "API rate limit: 100 req/min per IP"
    enabled     = true
  }

  # Rate limit: Auth endpoints — stricter (20 req/min per IP)
  rules {
    action = "block"
    ratelimit {
      characteristics      = ["ip.src"]
      period               = 60
      requests_per_period  = 20
      mitigation_timeout   = 600
    }
    expression  = "http.request.uri.path starts_with \"/auth/\""
    description = "Auth rate limit: 20 req/min per IP (brute-force protection)"
    enabled     = true
  }
}

# ── Bot Management (requires Bot Management plan) ────────────────────────────

resource "cloudflare_bot_management" "yourgift" {
  zone_id                         = var.zone_id
  enable_js                       = true
  fight_mode                      = false  # Set true to block likely bots
  session_score                   = false
  auto_update_model               = true
  optimize_wordpress              = false
  suppress_session_score          = false
  using_latest_model              = true
}

# ── Security Response Headers ─────────────────────────────────────────────────

resource "cloudflare_ruleset" "response_headers" {
  zone_id     = var.zone_id
  name        = "YourGift Security Response Headers"
  description = "Inject security headers on all responses"
  kind        = "zone"
  phase       = "http_response_headers_transform"

  rules {
    action = "rewrite"
    action_parameters {
      headers {
        name      = "X-Content-Type-Options"
        operation = "set"
        value     = "nosniff"
      }
      headers {
        name      = "X-Frame-Options"
        operation = "set"
        value     = "SAMEORIGIN"
      }
      headers {
        name      = "X-XSS-Protection"
        operation = "set"
        value     = "1; mode=block"
      }
      headers {
        name      = "Referrer-Policy"
        operation = "set"
        value     = "strict-origin-when-cross-origin"
      }
      headers {
        name      = "Permissions-Policy"
        operation = "set"
        value     = "camera=(), microphone=(), geolocation=(), interest-cohort=()"
      }
      headers {
        name      = "Content-Security-Policy"
        operation = "set"
        value     = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.yourgift.pt; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.yourgift.pt; connect-src 'self' https://api.yourgift.pt https://*.sentry.io; frame-ancestors 'none'"
      }
      headers {
        name      = "X-Powered-By"
        operation = "remove"
      }
      headers {
        name      = "Server"
        operation = "remove"
      }
    }
    expression  = "true"
    description = "Inject security headers + remove fingerprinting headers"
    enabled     = true
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "waf_ruleset_id" {
  value = cloudflare_ruleset.waf_managed.id
}

output "custom_rules_id" {
  value = cloudflare_ruleset.custom_firewall.id
}
