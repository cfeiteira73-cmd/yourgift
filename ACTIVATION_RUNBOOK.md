# ACTIVATION_RUNBOOK.md
# YourGift OS — Production Activation Runbook

**Version:** 1.0  
**Last Updated:** 2026-05-25  
**Owner:** Platform Engineering  
**Scope:** Covers activation of all 5 pending production items:
Multi-Region, Chaos Drills, MFA Enforcement, pgBouncer, Shadow Replay

---

## Prerequisites

Before starting any step, verify all of the following:

### Tools Required

```bash
# AWS CLI v2 with admin role configured
aws sts get-caller-identity

# Terraform >= 1.6
terraform version

# Node.js >= 20 + pnpm
node --version && pnpm --version

# tsx (for running scripts)
npx tsx --version

# GitHub CLI (for triggering Actions)
gh auth status
```

### AWS Console Access Required

- Route 53 (for DNS failover records)
- ECS (Fargate clusters, services, task definitions)
- RDS (Aurora PostgreSQL, replica status)
- ElastiCache (Redis cluster, replication groups)
- VPC (security groups, route tables, peering)
- ACM (SSL certificates in each region)
- CloudWatch (alarms, dashboards)

### Required GitHub Secrets

Verify all secrets are configured before any step:

| Secret | Description | Where to Get It |
|--------|-------------|----------------|
| `AWS_TERRAFORM_ROLE_ARN` | IAM role Terraform assumes for infra changes | AWS Console → IAM → Roles → `yourgift-terraform-role` → ARN |
| `AWS_ACCESS_KEY_ID` | AWS access key for CI/CD | AWS Console → IAM → Users → `github-actions` → Security Credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for CI/CD | Same as above (create new pair if lost) |
| `PRODUCTION_API_URL` | Production API base URL | e.g. `https://api.yourgift.pt` |
| `ADMIN_JWT_TOKEN` | Long-lived admin JWT (90-day) | Generate via `POST /admin/auth/token/long-lived` |
| `SLACK_CHAOS_WEBHOOK` | Slack incoming webhook for chaos alerts | Slack App settings → Incoming Webhooks |
| `SLACK_OPS_WEBHOOK` | Slack webhook for general ops alerts | Slack App settings → Incoming Webhooks |
| `DATABASE_URL_PRIMARY` | Primary RDS connection string | AWS Console → RDS → `yourgift-prod` → Connectivity |
| `DATABASE_URL_REPLICA` | Replica RDS connection string | AWS Console → RDS → `yourgift-prod-replica` → Connectivity |
| `REDIS_URL_PRIMARY` | Primary ElastiCache URL | AWS Console → ElastiCache → `yourgift-prod` → Primary endpoint |
| `TF_STATE_BUCKET` | S3 bucket for Terraform remote state | `yourgift-tf-state-prod` (existing) |
| `TF_STATE_LOCK_TABLE` | DynamoDB table for state locking | `yourgift-tf-lock` (existing) |
| `PGBOUNCER_AUTH_USER` | pgBouncer auth user password | Generate: `openssl rand -base64 32` |
| `SHADOW_REPLAY_TARGET_URL` | Shadow replay secondary target URL | Secondary region API URL |

### Verify Secrets in GitHub

```bash
gh secret list --repo yourgift-os/yourgift-os
```

---

## Step 1: MFA Enforcement (ETA: 30 min)

**Goal:** Enforce TOTP-based MFA on all admin accounts before activating any other step.  
**Risk:** Low — affects admin login only.  
**Maintenance Window:** Not required.

### 1.1 Generate Admin JWT Token

```bash
# Authenticate to production API
curl -X POST https://api.yourgift.pt/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourgift.pt","password":"<ADMIN_PASSWORD>"}' \
  | jq .accessToken

# Export the token
export YOURGIFT_ADMIN_TOKEN=<token-from-above>
export YOURGIFT_API_URL=https://api.yourgift.pt
```

### 1.2 Enroll Primary Admin

```bash
cd /path/to/yourgift-os

# Run enrollment for primary admin
tsx scripts/mfa-enroll.ts admin@yourgift.pt
```

The script will:
1. Generate a TOTP secret and QR URI
2. Display the base32 secret and OTP auth URI
3. Prompt for a 6-digit code from your authenticator app (Google Authenticator, Authy, 1Password, etc.)
4. Enable MFA and print one-time backup codes

**Save backup codes immediately in your team password manager.**

### 1.3 Enroll Additional Admins

Repeat for each admin account:

```bash
tsx scripts/mfa-enroll.ts ops@yourgift.pt
tsx scripts/mfa-enroll.ts cto@yourgift.pt
```

### 1.4 Enable MFA Enforcement Policy

```bash
# Enable server-side MFA enforcement (blocks login without MFA)
curl -X POST https://api.yourgift.pt/admin/auth/mfa/enforce \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enforceForAll": true, "gracePeriodHours": 0}'
```

### 1.5 Verify MFA Enforcement

```bash
# Attempt login without MFA — should return 403 with mfa_required
curl -X POST https://api.yourgift.pt/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourgift.pt","password":"<password>"}' \
  | jq .error
# Expected: "mfa_required"
```

### 1.6 Rollback (if needed)

```bash
curl -X POST https://api.yourgift.pt/admin/auth/mfa/enforce \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enforceForAll": false}'
```

---

## Step 2: Multi-Region Activation (ETA: 2h)

**Goal:** Deploy API and infrastructure to secondary AWS region for active-passive failover.  
**Risk:** Medium — DNS changes, new ECS services, RDS cross-region replica.  
**Maintenance Window:** Recommended (low traffic period).

### 2.1 Verify Primary Region Health

```bash
# Check primary ECS services are healthy
aws ecs list-services --cluster yourgift-prod --region eu-west-1
aws ecs describe-services \
  --cluster yourgift-prod \
  --services yourgift-api yourgift-worker \
  --region eu-west-1 \
  | jq '.services[].runningCount'

# Check RDS replica lag
aws rds describe-db-instances \
  --db-instance-identifier yourgift-prod \
  --region eu-west-1 \
  | jq '.DBInstances[0].ReplicaLag // "N/A"'
```

### 2.2 Trigger Multi-Region Terraform via GitHub Actions

```bash
# Trigger the multi-region infrastructure workflow
gh workflow run multi-region-deploy.yml \
  --repo yourgift-os/yourgift-os \
  --field environment=production \
  --field primary_region=eu-west-1 \
  --field secondary_region=us-east-1 \
  --field dry_run=false

# Monitor the workflow
gh run list --workflow=multi-region-deploy.yml --limit 1
gh run watch $(gh run list --workflow=multi-region-deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
```

### 2.3 Manual Terraform Apply (Alternative)

```bash
cd infra/terraform/multi-region

# Initialize with remote state
terraform init \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="dynamodb_table=$TF_STATE_LOCK_TABLE" \
  -backend-config="region=eu-west-1"

# Plan — review carefully
terraform plan \
  -var="primary_region=eu-west-1" \
  -var="secondary_region=us-east-1" \
  -var="environment=production" \
  -out=multi-region.tfplan

# Review plan output, then apply
terraform apply multi-region.tfplan
```

### 2.4 Verify Secondary Region

```bash
# Check secondary ECS services
aws ecs list-services --cluster yourgift-prod-secondary --region us-east-1

# Health check secondary API
curl https://api-us.yourgift.pt/health | jq .

# Verify RDS cross-region replica
aws rds describe-db-instances \
  --db-instance-identifier yourgift-prod-replica-us \
  --region us-east-1 \
  | jq '{status: .DBInstances[0].DBInstanceStatus, replicaSource: .DBInstances[0].ReadReplicaSourceDBInstanceIdentifier}'
```

### 2.5 Configure Route 53 Health Checks and Failover

```bash
# Verify Route 53 failover records were created by Terraform
aws route53 list-health-checks | jq '.HealthChecks[] | {id: .Id, config: .HealthCheckConfig}'

# Test DNS resolution
dig api.yourgift.pt
# Should resolve to primary region IP

# Simulate failover record (for testing — do NOT apply in production without Step 3)
# aws route53 change-resource-record-sets ... (managed by Terraform)
```

### 2.6 Rollback

```bash
# Destroy secondary region resources
cd infra/terraform/multi-region
terraform destroy \
  -var="primary_region=eu-west-1" \
  -var="secondary_region=us-east-1" \
  -var="environment=production" \
  -target=module.secondary_region \
  -auto-approve
```

---

## Step 3: First Chaos Drill (ETA: 1h)

**Goal:** Run a latency injection drill against production to validate observability and MTTR.  
**Risk:** Low for latency injection. Medium/High for db_failover and redis_outage.  
**Maintenance Window:** Required for db_failover and full_region_isolation.

### 3.1 Set Up Environment

```bash
export YOURGIFT_API_URL=https://api.yourgift.pt
export YOURGIFT_ADMIN_TOKEN=<your-admin-jwt>
```

### 3.2 Run First Drill via CLI (Latency Injection — Safe to run anytime)

```bash
cd /path/to/yourgift-os

# 30-second latency injection drill
tsx scripts/chaos-drill.ts latency_injection 30
```

Expected output:
- Real-time status updates every 2s
- Final report with MTTR, RTO/RPO status, findings

### 3.3 Run Drill via GitHub Actions (Recommended for Production)

```bash
# Trigger chaos drill workflow
gh workflow run chaos-drill.yml \
  --repo yourgift-os/yourgift-os \
  --field drill_type=latency_injection \
  --field duration_seconds=30 \
  --field environment=production \
  --field notify_slack=true

# Watch the workflow
gh run list --workflow=chaos-drill.yml --limit 1
gh run watch $(gh run list --workflow=chaos-drill.yml --limit 1 --json databaseId -q '.[0].databaseId')
```

### 3.4 Available Drill Types and Recommended Order

| Drill Type | Risk | Duration | Run Condition |
|------------|------|----------|---------------|
| `latency_injection` | Low | 30s | Anytime |
| `stripe_timeout` | Low | 30s | Anytime (payments use queues) |
| `queue_corruption` | Medium | 30s | Low-traffic window |
| `memory_pressure` | Medium | 60s | Low-traffic window |
| `redis_outage` | High | 30s | Maintenance window |
| `db_failover` | High | 60s | Maintenance window |

```bash
# Full drill suite (run in order, with manual approval between each)
tsx scripts/chaos-drill.ts latency_injection 30
tsx scripts/chaos-drill.ts stripe_timeout 30
tsx scripts/chaos-drill.ts queue_corruption 30
tsx scripts/chaos-drill.ts memory_pressure 60
tsx scripts/chaos-drill.ts redis_outage 30
tsx scripts/chaos-drill.ts db_failover 60
```

### 3.5 Run Failover Drills

```bash
# After chaos drills pass, run failover drills
tsx scripts/failover-drill.ts db_primary_failover
tsx scripts/failover-drill.ts redis_primary_failover

# Full region isolation — only after multi-region is active (Step 2)
tsx scripts/failover-drill.ts full_region_isolation
```

### 3.6 Interpret Results

| Metric | Target | Action if Missed |
|--------|--------|-----------------|
| MTTR | < 2 min | Review alerting thresholds, PagerDuty escalation |
| RTO | < 5 min | Review ECS deployment speed, health check intervals |
| RPO | < 1 min | Review WAL shipping lag, backup frequency |
| Error Rate during drill | < 1% | Review circuit breakers, retry logic |

### 3.7 Rollback (Abort Running Drill)

```bash
# Get the drill ID from the output or API
DRILL_ID=<drill-id-from-output>

curl -X POST https://api.yourgift.pt/admin/chaos/drills/$DRILL_ID/abort \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual abort — operator request"}'
```

---

## Step 4: pgBouncer Activation (ETA: 30 min)

**Goal:** Front RDS connections with pgBouncer for connection pooling, reducing DB load.  
**Risk:** Low — pgBouncer sits transparently between API and RDS.  
**Maintenance Window:** Not required, but recommended for initial switch.

### 4.1 Verify Current Connection Count

```bash
# Check current RDS connection count (before pgBouncer)
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=yourgift-prod \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Maximum \
  --region eu-west-1 \
  | jq '.Datapoints | sort_by(.Timestamp) | last | .Maximum'
```

### 4.2 Apply pgBouncer Infrastructure

```bash
cd infra/terraform/pgbouncer

terraform init \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="dynamodb_table=$TF_STATE_LOCK_TABLE" \
  -backend-config="region=eu-west-1"

terraform plan \
  -var="environment=production" \
  -var="rds_host=yourgift-prod.cluster-xxxx.eu-west-1.rds.amazonaws.com" \
  -var="rds_port=5432" \
  -var="pool_mode=transaction" \
  -var="max_client_conn=1000" \
  -var="default_pool_size=20" \
  -out=pgbouncer.tfplan

terraform apply pgbouncer.tfplan
```

### 4.3 Update DATABASE_URL

```bash
# Get the pgBouncer endpoint from Terraform output
PGBOUNCER_HOST=$(terraform output -raw pgbouncer_endpoint)
PGBOUNCER_PORT=$(terraform output -raw pgbouncer_port)

echo "New DATABASE_URL: postgresql://yourgift:***@${PGBOUNCER_HOST}:${PGBOUNCER_PORT}/yourgift_prod"

# Update in AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id yourgift/production/database-url \
  --secret-string "postgresql://yourgift:${DB_PASSWORD}@${PGBOUNCER_HOST}:${PGBOUNCER_PORT}/yourgift_prod" \
  --region eu-west-1

# Update ECS task definition to pick up new secret value
# (Trigger a new deployment)
aws ecs update-service \
  --cluster yourgift-prod \
  --service yourgift-api \
  --force-new-deployment \
  --region eu-west-1
```

### 4.4 Verify pgBouncer is Working

```bash
# Check pgBouncer stats (connect via pgBouncer admin interface)
psql -h $PGBOUNCER_HOST -p $PGBOUNCER_PORT -U pgbouncer pgbouncer \
  -c "SHOW POOLS;"

# Verify API health after deployment
curl https://api.yourgift.pt/health | jq .

# Check DB connections reduced vs Step 4.1
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=yourgift-prod \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics Maximum \
  --region eu-west-1 \
  | jq '.Datapoints | sort_by(.Timestamp) | last | .Maximum'
# Should be lower than before
```

### 4.5 Rollback

```bash
# Restore original DATABASE_URL
aws secretsmanager update-secret \
  --secret-id yourgift/production/database-url \
  --secret-string "postgresql://yourgift:${DB_PASSWORD}@yourgift-prod.cluster-xxxx.eu-west-1.rds.amazonaws.com:5432/yourgift_prod" \
  --region eu-west-1

# Force new ECS deployment to pick up original URL
aws ecs update-service \
  --cluster yourgift-prod \
  --service yourgift-api \
  --force-new-deployment \
  --region eu-west-1

# Optionally destroy pgBouncer (after traffic fully shifted back)
terraform destroy -target=module.pgbouncer -auto-approve
```

---

## Step 5: Shadow Replay Activation (ETA: 1h)

**Goal:** Mirror production traffic to shadow environment for safe testing of infrastructure changes.  
**Risk:** Low — shadow environment is read-only; no writes reach production from shadow.  
**Maintenance Window:** Not required.

### 5.1 Apply Shadow Replay Infrastructure

```bash
cd infra/terraform/shadow-replay

terraform init \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="dynamodb_table=$TF_STATE_LOCK_TABLE" \
  -backend-config="region=eu-west-1"

terraform plan \
  -var="environment=production" \
  -var="primary_api_url=https://api.yourgift.pt" \
  -var="shadow_api_url=https://api-shadow.yourgift.pt" \
  -var="replay_percentage=10" \
  -var="exclude_paths=/admin,/webhooks/stripe" \
  -out=shadow-replay.tfplan

terraform apply shadow-replay.tfplan
```

### 5.2 Verify Shadow Replay Infrastructure

```bash
# Get shadow replay endpoint
SHADOW_REPLAY_ENDPOINT=$(cd infra/terraform/shadow-replay && terraform output -raw replay_proxy_url)

# Check health of replay proxy
curl $SHADOW_REPLAY_ENDPOINT/health | jq .

# Verify shadow API is receiving traffic (check shadow API logs)
aws logs tail /ecs/yourgift-api-shadow \
  --region eu-west-1 \
  --since 5m \
  --format short
```

### 5.3 Configure Replay Percentage

```bash
# Start with 10% of traffic mirrored to shadow
curl -X PATCH https://api.yourgift.pt/admin/shadow-replay/config \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "replayPercentage": 10,
    "excludePaths": ["/admin", "/webhooks/stripe", "/auth/mfa"],
    "enabled": true
  }'

# Verify configuration
curl https://api.yourgift.pt/admin/shadow-replay/config \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  | jq .
```

### 5.4 Monitor Shadow Replay Divergence

```bash
# Check divergence metrics (shadow vs primary response comparison)
curl https://api.yourgift.pt/admin/shadow-replay/metrics \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  | jq '{
      totalReplayed: .totalReplayed,
      divergenceRate: .divergenceRate,
      p99LatencyDiffMs: .p99LatencyDiffMs,
      errorRateShadow: .errorRateShadow
    }'

# View divergence report for last hour
curl "https://api.yourgift.pt/admin/shadow-replay/divergence?since=1h" \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  | jq '.divergences[:5]'
```

### 5.5 Increase Replay Percentage (After 24h Validation)

```bash
# Increase to 25% after 24h with no issues
curl -X PATCH https://api.yourgift.pt/admin/shadow-replay/config \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"replayPercentage": 25}'

# 48h later: increase to 50%
curl -X PATCH https://api.yourgift.pt/admin/shadow-replay/config \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"replayPercentage": 50}'
```

### 5.6 Rollback

```bash
# Disable shadow replay immediately
curl -X PATCH https://api.yourgift.pt/admin/shadow-replay/config \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Destroy shadow infrastructure if needed
cd infra/terraform/shadow-replay
terraform destroy -auto-approve
```

---

## Activation Sequence Summary

Run steps in this order. Do not skip steps.

```
Step 1: MFA Enforcement    [30 min]  ──► No maintenance window needed
Step 2: Multi-Region       [2h]      ──► Low-traffic window recommended
Step 3: Chaos Drills       [1h]      ──► Maintenance window for db/redis drills
Step 4: pgBouncer          [30 min]  ──► Low-traffic window recommended
Step 5: Shadow Replay      [1h]      ──► No maintenance window needed
```

Total estimated time: **5h** (can parallelize Steps 4 and 5 after Step 2 completes)

---

## Verification Checklist

After all steps complete, verify:

```bash
# 1. MFA enforced
curl -X POST https://api.yourgift.pt/admin/auth/login \
  -d '{"email":"admin@yourgift.pt","password":"wrong"}' | jq .error

# 2. Multi-region health
curl https://api.yourgift.pt/health | jq '{region: .region, status: .status}'
curl https://api-us.yourgift.pt/health | jq '{region: .region, status: .status}'

# 3. Chaos drill — quick smoke test
tsx scripts/chaos-drill.ts latency_injection 15

# 4. pgBouncer pool stats
psql -h $PGBOUNCER_HOST -p 5432 -U pgbouncer pgbouncer -c "SHOW STATS;"

# 5. Shadow replay active
curl https://api.yourgift.pt/admin/shadow-replay/config \
  -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" | jq .enabled
```

---

## Emergency Contacts

| Role | Contact | When to Call |
|------|---------|-------------|
| Platform Lead | ops@yourgift.pt | Any activation failure |
| AWS Support | AWS Console → Support | AWS service issues |
| PagerDuty | Configured in ops | Automated alerts |

---

## Rollback Summary (One-Liners)

```bash
# Step 1 — Disable MFA enforcement
curl -X POST https://api.yourgift.pt/admin/auth/mfa/enforce -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" -d '{"enforceForAll":false}'

# Step 2 — Destroy secondary region
cd infra/terraform/multi-region && terraform destroy -target=module.secondary_region -auto-approve

# Step 3 — Abort running drill
curl -X POST https://api.yourgift.pt/admin/chaos/drills/$DRILL_ID/abort -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" -d '{"reason":"manual abort"}'

# Step 4 — Restore original DATABASE_URL and redeploy
aws secretsmanager update-secret --secret-id yourgift/production/database-url --secret-string "$ORIGINAL_DATABASE_URL" && aws ecs update-service --cluster yourgift-prod --service yourgift-api --force-new-deployment --region eu-west-1

# Step 5 — Disable shadow replay
curl -X PATCH https://api.yourgift.pt/admin/shadow-replay/config -H "Authorization: Bearer $YOURGIFT_ADMIN_TOKEN" -d '{"enabled":false}'
```
