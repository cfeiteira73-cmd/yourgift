# YourGift OS — Terraform AWS Infrastructure

Production-grade AWS infrastructure for YourGift OS, managed with Terraform.

## Architecture Overview

```
Internet → Route53 → ALB (WAF) → ECS Fargate (NestJS API)
                                        ↓               ↓
                                   RDS PostgreSQL   ElastiCache Redis
                                   (private subnet)  (private subnet)

S3 (private) ← ECS task uploads
    ↓
CloudFront CDN → assets.yourgift.pt
```

**Resources provisioned:**
- VPC with 2 public + 2 private subnets across 2 AZs
- NAT Gateway for private subnet egress
- Application Load Balancer with WAF (SQLi, common rules, rate limiting)
- ECS Fargate cluster + service with CPU/memory auto-scaling (1–10 tasks)
- RDS PostgreSQL 16 (encrypted, 7-day backups, deletion protection)
- ElastiCache Redis 7 with automatic failover (2 nodes)
- S3 bucket with CloudFront OAC (no public access)
- ACM certificates for `api.yourgift.pt` and `assets.yourgift.pt`
- Route53 A records
- CloudWatch alarms + dashboard
- Secrets Manager for all sensitive credentials

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Terraform | >= 1.6 | https://developer.hashicorp.com/terraform/downloads |
| AWS CLI | >= 2.x | https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html |
| Docker | >= 24 | https://docs.docker.com/get-docker/ |

AWS credentials must be configured (`aws configure` or environment variables `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).

The IAM user/role needs at minimum: `AdministratorAccess` (or a scoped policy covering VPC, EC2, ECS, RDS, ElastiCache, S3, CloudFront, Route53, ACM, WAFv2, SecretsManager, IAM, CloudWatch).

---

## First-Time Setup

### 1. Create the Terraform state bucket

This must exist before `terraform init`. Run once:

```bash
aws s3 mb s3://yourgift-terraform-state --region eu-west-1
aws s3api put-bucket-versioning \
  --bucket yourgift-terraform-state \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption \
  --bucket yourgift-terraform-state \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

### 2. Create ECR repository

```bash
aws ecr create-repository \
  --repository-name yourgift-api \
  --region eu-west-1 \
  --image-scanning-configuration scanOnPush=true
```

Note the repository URI (e.g. `123456789.dkr.ecr.eu-west-1.amazonaws.com/yourgift-api`).

### 3. Build and push the initial Docker image

```bash
# From repo root
aws ecr get-login-password --region eu-west-1 \
  | docker login --username AWS --password-stdin \
    123456789.dkr.ecr.eu-west-1.amazonaws.com

docker build -f docker/api.Dockerfile -t yourgift-api:latest .
docker tag yourgift-api:latest \
  123456789.dkr.ecr.eu-west-1.amazonaws.com/yourgift-api:latest
docker push 123456789.dkr.ecr.eu-west-1.amazonaws.com/yourgift-api:latest
```

### 4. Ensure yourgift.pt is hosted in Route53

```bash
# Check existing hosted zones
aws route53 list-hosted-zones
```

If not, create it and update your domain registrar's nameservers.

### 5. Initialise Terraform

```bash
cd terraform
terraform init
```

---

## Setting Secrets in AWS Secrets Manager

After `terraform apply` creates the secret placeholders, populate them:

```bash
# PostgreSQL connection string (pooled — used by NestJS/Prisma at runtime)
aws secretsmanager put-secret-value \
  --secret-id yourgift/database-url \
  --secret-string "postgresql://yourgift:<PASSWORD>@<RDS_ENDPOINT>:5432/yourgift?pgbouncer=true&connection_limit=10"

# Direct URL (non-pooled — used by Prisma migrate)
aws secretsmanager put-secret-value \
  --secret-id yourgift/direct-url \
  --secret-string "postgresql://yourgift:<PASSWORD>@<RDS_ENDPOINT>:5432/yourgift"

# JWT secret (generate a strong random string)
aws secretsmanager put-secret-value \
  --secret-id yourgift/jwt-secret \
  --secret-string "$(openssl rand -hex 64)"

# Redis URL (from ElastiCache output)
aws secretsmanager put-secret-value \
  --secret-id yourgift/redis-url \
  --secret-string "rediss://<REDIS_PRIMARY_ENDPOINT>:6379"

# Stripe keys
aws secretsmanager put-secret-value \
  --secret-id yourgift/stripe-secret-key \
  --secret-string "sk_live_..."

aws secretsmanager put-secret-value \
  --secret-id yourgift/stripe-webhook-secret \
  --secret-string "whsec_..."

# Midocean API key
aws secretsmanager put-secret-value \
  --secret-id yourgift/midocean-api-key \
  --secret-string "<MIDOCEAN_KEY>"
```

Get the RDS endpoint and Redis endpoint from Terraform outputs:

```bash
terraform output rds_endpoint
terraform output redis_endpoint
```

---

## Deploy Commands

```bash
cd terraform

# Preview changes
terraform plan -var="api_image=123456789.dkr.ecr.eu-west-1.amazonaws.com/yourgift-api:latest"

# Apply (first deploy takes ~15–20 min for RDS + ElastiCache)
terraform apply -var="api_image=123456789.dkr.ecr.eu-west-1.amazonaws.com/yourgift-api:latest"

# Or use a tfvars file (recommended for CI)
cp terraform.tfvars.example terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

Example `terraform.tfvars`:
```hcl
aws_region        = "eu-west-1"
environment       = "production"
project_name      = "yourgift"
api_image         = "123456789.dkr.ecr.eu-west-1.amazonaws.com/yourgift-api:v1.2.3"
domain_name       = "yourgift.pt"
db_instance_class = "db.t3.small"
redis_node_type   = "cache.t3.micro"
api_cpu           = 512
api_memory        = 1024
api_desired_count = 2
```

---

## Updating the API (Deploying a New Image)

Build, push, then force a new ECS deployment:

```bash
# 1. Build & push
TAG=$(git rev-parse --short HEAD)
IMAGE="123456789.dkr.ecr.eu-west-1.amazonaws.com/yourgift-api:$TAG"

docker build -f docker/api.Dockerfile -t $IMAGE .
docker push $IMAGE

# 2. Update Terraform (updates task definition)
terraform apply -var="api_image=$IMAGE"

# 3. Force new deployment (if only the image changed, not infra)
aws ecs update-service \
  --cluster yourgift-cluster \
  --service yourgift-api \
  --force-new-deployment \
  --region eu-west-1
```

Rolling update with zero downtime is handled automatically by ECS (minimum 50% healthy, maximum 200%).

---

## Running Database Migrations

Prisma migrations must be run against the `DIRECT_URL` (non-pooled connection), from a machine with network access to the private RDS subnet (e.g. a bastion, VPN, or temporary ECS task):

```bash
# From within the VPC (e.g. via AWS SSM Session Manager on a bastion)
export DIRECT_URL="postgresql://yourgift:<PASSWORD>@<RDS_ENDPOINT>:5432/yourgift"
export DATABASE_URL="$DIRECT_URL"
npx prisma migrate deploy --schema services/api/prisma/schema.prisma
```

Or run as a one-off ECS task using the same container image with an override command.

---

## Subscribe to CloudWatch Alerts

After apply, subscribe your email to the SNS topic:

```bash
aws sns subscribe \
  --topic-arn $(terraform output -raw alerts_sns_arn) \
  --protocol email \
  --notification-endpoint ops@yourgift.pt
```

---

## Cost Estimate (eu-west-1, monthly)

| Resource | Spec | Est. Cost |
|----------|------|-----------|
| ECS Fargate | 2 tasks × 0.5 vCPU / 1 GB | ~€30 |
| RDS PostgreSQL | db.t3.micro, 20 GB | ~€20 |
| ElastiCache Redis | cache.t3.micro × 2 | ~€25 |
| NAT Gateway | ~100 GB/month | ~€15 |
| ALB | low traffic | ~€18 |
| CloudFront | first 1 TB free | ~€0–5 |
| WAF | 1 ACL + 4 rules | ~€10 |
| Secrets Manager | 7 secrets | ~€3 |
| CloudWatch | logs + alarms | ~€5 |
| Route53 | 1 hosted zone | ~€1 |
| **Total** | | **~€130/month** |

Scale-up scenario (db.t3.small + 4 ECS tasks): ~€200/month.

---

## Destroying the Infrastructure

**WARNING: This will delete ALL data including the RDS database (final snapshot will be taken but must be deleted manually to avoid ongoing storage costs).**

```bash
# Step 1: Disable deletion protection on RDS (Terraform can't delete a protected DB)
aws rds modify-db-instance \
  --db-instance-identifier yourgift-postgres \
  --no-deletion-protection \
  --apply-immediately

# Step 2: Disable ALB deletion protection
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn <ALB_ARN> \
  --attributes Key=deletion_protection.enabled,Value=false

# Step 3: Empty the S3 bucket (Terraform cannot delete a non-empty bucket)
aws s3 rm s3://yourgift-assets-production --recursive

# Step 4: Destroy
terraform destroy -var="api_image=dummy"
```

The S3 state bucket and ECR repository are NOT managed by this Terraform config and must be deleted manually if needed.
