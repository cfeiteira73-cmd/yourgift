# YourGift OS — Deploy Guide

## Pré-requisitos

- Conta AWS com permissões de administrador
- AWS CLI instalado e configurado (`aws configure`)
- Terraform >= 1.6
- pnpm >= 8

---

## 1. Bootstrap AWS (uma vez)

### Criar bucket S3 para Terraform state
```bash
aws s3 mb s3://yourgift-terraform-state --region eu-west-1
aws s3api put-bucket-versioning \
  --bucket yourgift-terraform-state \
  --versioning-configuration Status=Enabled
```

### Configurar OIDC para GitHub Actions (uma vez)
```bash
# Criar OIDC provider para GitHub
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

---

## 2. Provisionar Infraestrutura com Terraform

```bash
cd infra/terraform

# Inicializar
terraform init

# Preview
terraform plan -var="env=production" -var="api_image_tag=latest"

# Aplicar
terraform apply -var="env=production" -var="api_image_tag=latest"
```

Outputs importantes após apply:
- `ecr_api_url` → copiar para GitHub Secret `ECR_REGISTRY`
- `alb_dns_name` → configurar no DNS como CNAME para api.yourgift.pt
- `cloudfront_domain` → configurar no DNS como CNAME para cdn.yourgift.pt
- `rds_endpoint` → usar em DATABASE_URL

---

## 3. Configurar Secrets no AWS Secrets Manager

```bash
aws secretsmanager update-secret \
  --secret-id yourgift/production/api \
  --secret-string '{
    "DATABASE_URL": "postgresql://postgres:PASSWORD@RDS_ENDPOINT:5432/yourgift",
    "DIRECT_URL": "postgresql://postgres:PASSWORD@RDS_ENDPOINT:5432/yourgift",
    "JWT_SECRET": "GERA_UM_SECRET_LONGO_AQUI",
    "STRIPE_KEY": "sk_live_...",
    "STRIPE_WEBHOOK_SECRET": "whsec_...",
    "MIDOCEAN_KEY": "...",
    "PF_CONCEPT_KEY": "...",
    "S3_BUCKET": "yourgift-assets-production",
    "CLOUDFRONT_URL": "https://cdn.yourgift.pt",
    "RESEND_KEY": "re_..."
  }'
```

---

## 4. Configurar GitHub Secrets

Vai a: **GitHub → yourgift repo → Settings → Secrets and variables → Actions**

Adiciona estes secrets:

| Secret | Valor |
|--------|-------|
| `AWS_ACCOUNT_ID` | ID da tua conta AWS (12 dígitos) |
| `AWS_ACCESS_KEY_ID` | Access key de um IAM user com permissões ECS/ECR |
| `AWS_SECRET_ACCESS_KEY` | Secret key correspondente |
| `API_URL` | https://api.yourgift.pt |
| `ADMIN_API_TOKEN` | Token seguro para o cron de sync (gera com `openssl rand -hex 32`) |

---

## 5. Aplicar Migração DB

```bash
# Com acesso direto ao RDS (via bastion ou VPN)
cd services/api
pnpm prisma migrate deploy --schema prisma/schema.prisma

# OU via Supabase MCP (já feito - 18 tabelas criadas)
```

---

## 6. Trigger Deploy Manual

```bash
# Push para master dispara o workflow automaticamente
git push origin master

# OU trigger manual no GitHub
# Actions → "Deploy to Production" → Run workflow
```

---

## 7. Verificar Deploy

```bash
# Status do serviço ECS
aws ecs describe-services \
  --cluster yourgift-production \
  --services yourgift-api-production \
  --region eu-west-1

# Logs em tempo real
aws logs tail /ecs/yourgift-api-production --follow

# Health check
curl https://api.yourgift.pt/api/v1/health
```

---

## Arquitectura Final

```
                    ┌─────────────────┐
                    │   CloudFront    │
                    │  cdn.yourgift.pt│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   S3 Bucket     │
                    │ yourgift-assets │
                    └─────────────────┘

┌──────────────┐    ┌────────────────┐    ┌─────────────────┐
│  yourgift.pt │    │      ALB       │    │   ECS Fargate   │
│  (Vercel)    │───▶│api.yourgift.pt │───▶│  NestJS API     │
└──────────────┘    └────────────────┘    │  (2 tasks)      │
                                          └────────┬────────┘
┌──────────────┐                                   │
│  admin.      │                          ┌────────▼────────┐
│  yourgift.pt │                          │  RDS PostgreSQL  │
│  (Vercel)    │                          │  + Redis Cache  │
└──────────────┘                          └─────────────────┘
```

---

## Custos Estimados (produção)

| Serviço | Custo/mês |
|---------|-----------|
| ECS Fargate (2 tasks) | ~80€ |
| RDS t3.medium | ~60€ |
| ALB | ~20€ |
| S3 + CloudFront | ~15€ |
| Secrets Manager | ~5€ |
| **TOTAL** | **~180€/mês** |
