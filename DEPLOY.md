# YourGift OS — Deploy Guide (Railway + Vercel)

Stack: **Railway** (API) · **Vercel** (Web + Admin) · **Supabase** (DB — já configurado)  
Custo estimado: ~15€/mês total

---

## Arquitectura

```
yourgift.pt        api.yourgift.pt      admin.yourgift.pt
(Vercel)      →    (Railway)       ←    (Vercel)
     │                  │
     └──────────────────┴──── Supabase (PostgreSQL)
```

---

## 1. Railway — API NestJS

### 1.1 Criar projecto Railway

1. Vai a [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → selecciona `cfeiteira73-cmd/yourgift`
3. Quando pedir o **Root Directory** → define como `/services/api`
4. Railway detecta o `railway.toml` e usa Nixpacks

### 1.2 Variáveis de ambiente Railway

No painel Railway → **Variables**, adiciona:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@db.SUPABASE_REF.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:PASSWORD@db.SUPABASE_REF.supabase.co:5432/postgres
JWT_SECRET=gera_com_openssl_rand_base64_32
JWT_EXPIRY=7d
STRIPE_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
MIDOCEAN_KEY=...
PF_CONCEPT_KEY=...
S3_BUCKET=yourgift-assets
CLOUDFRONT_URL=https://cdn.yourgift.pt
RESEND_KEY=re_...
ADMIN_API_TOKEN=gera_com_openssl_rand_hex_32
PORT=3001
NODE_ENV=production
```

> **DATABASE_URL e DIRECT_URL**: vai ao Supabase → Settings → Database → Connection String → URI

### 1.3 Domínio personalizado

Railway → **Settings** → **Domains** → **Custom Domain**  
Adiciona: `api.yourgift.pt`  
Copia o CNAME que o Railway te dá → adiciona no teu DNS

---

## 2. Vercel — Web Portal

### 2.1 Criar projecto Vercel (Web)

```bash
# No terminal, na raiz do repo
npx vercel --prod
```

Quando perguntar:
- **Root directory**: `.` (raiz do monorepo)
- O `vercel.json` já está configurado para builds o `apps/web`

### 2.2 Variáveis de ambiente Vercel (Web)

```env
NEXT_PUBLIC_API_URL=https://api.yourgift.pt
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 2.3 Domínio

Vercel → **Domains** → Adiciona `yourgift.pt`

---

## 3. Vercel — Admin Dashboard

### 3.1 Criar projecto Vercel (Admin)

```bash
# Na pasta apps/admin
cd apps/admin
npx vercel --prod
```

Quando perguntar:
- Selecciona "existing project" ou cria novo

### 3.2 Variáveis de ambiente Vercel (Admin)

```env
NEXT_PUBLIC_API_URL=https://api.yourgift.pt
ADMIN_API_TOKEN=mesmo_token_que_o_railway
```

### 3.3 Domínio

Vercel → **Domains** → Adiciona `admin.yourgift.pt`

---

## 4. GitHub Secrets (para CI/CD automático)

Vai a: **GitHub → yourgift → Settings → Secrets and variables → Actions**

| Secret | Como obter |
|--------|-----------|
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens → New Token |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Vercel → Account Settings → `id` no JSON |
| `VERCEL_WEB_PROJECT_ID` | Vercel → Web Project → Settings → `id` |
| `VERCEL_ADMIN_PROJECT_ID` | Vercel → Admin Project → Settings → `id` |

> Com estes 5 secrets, qualquer push para `master` faz deploy automático.

---

## 5. Verificar Deploy

```bash
# Health check API
curl https://api.yourgift.pt/api/v1/health

# Logs Railway (em tempo real)
railway logs --service yourgift-api

# Status Railway
railway status
```

---

## 6. Stripe Webhook

No Stripe Dashboard → **Webhooks** → **Add endpoint**:
- URL: `https://api.yourgift.pt/api/v1/payments/webhook`
- Events: `checkout.session.completed`, `payment_intent.succeeded`
- Copia o `whsec_...` → adiciona como `STRIPE_WEBHOOK_SECRET` no Railway

---

## Custos Estimados

| Serviço | Custo/mês |
|---------|-----------|
| Railway (Hobby) | ~5€ |
| Vercel (Hobby) | Grátis |
| Supabase (Free tier) | Grátis |
| Resend (3k emails/mês) | Grátis |
| **TOTAL** | **~5€/mês** |

> Quando escalares: Railway Pro (~20€) + Supabase Pro (~25€) = ~50€/mês

---

## Upgrade path → AWS (quando necessário)

Se precisares de escalar para AWS ECS (>10k orders/mês):
1. `aws configure` com credenciais IAM
2. `cd infra/terraform && terraform init && terraform apply`
3. Actualiza GitHub secrets com credenciais AWS
4. Muda `deploy.yml` de volta para ECR + ECS
