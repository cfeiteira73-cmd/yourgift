# yourgift.pt — Setup Guide

## ⚠️ PRIMEIRO PASSO: Corrigir o npm

O npm no teu sistema está corrompido. Para corrigir:

**Opção 1 — Reinstalar Node.js (recomendado):**
1. Desinstala o Node.js em Painel de Controlo → Programas
2. Descarrega o instalador LTS em https://nodejs.org
3. Instala novamente

**Opção 2 — Corrigir manualmente (requer admin):**
```powershell
# Abrir PowerShell como Administrador
npm install -g npm@latest
```

---

## Instalação do projeto

```bash
# 1. Entrar na pasta
cd yourgift

# 2. Instalar dependências
npm install

# 3. Copiar variáveis de ambiente
cp .env.example .env.local

# 4. Configurar o .env.local com as tuas keys:
#    - CLERK: https://clerk.com (grátis)
#    - DATABASE_URL: https://supabase.com (grátis)
#    - RESEND: https://resend.com (grátis)
#    - STRIPE: https://stripe.com (test mode)

# 5. Inicializar a base de dados
npm run db:push
npm run db:generate

# 6. Seed (dados demo)
npm run db:seed

# 7. Arrancar o servidor
npm run dev
```

Abre http://localhost:3000

---

## Stack

| Área | Tecnologia |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Animações | Framer Motion |
| Auth | Clerk |
| DB ORM | Prisma |
| Base de dados | Supabase (PostgreSQL) |
| Emails | Resend |
| Pagamentos | Stripe |
| Deploy | Vercel |

---

## Estrutura de pastas

```
app/
  (marketing)/     → Páginas públicas
  (auth)/          → Login / Sign-up
  (dashboard)/     → Área cliente
  (store)/         → Company stores
  api/             → Route handlers

components/
  layout/          → Header, Footer
  marketing/       → Homepage sections
  catalog/         → Catálogo e produtos
  rfq/             → Formulário de proposta
  dashboard/       → UI do dashboard
  shared/          → Componentes partilhados

lib/               → Utils, SEO, DB, Analytics
actions/           → Server actions
types/             → TypeScript types
config/            → Site config, nav, tokens
prisma/            → Schema + seed
```

---

## Deploy (Vercel)

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Deploy
vercel --prod

# 3. Configurar env vars no dashboard Vercel
```

---

## Checklist pré-lançamento

- [ ] Clerk configurado com domínio yourgift.pt
- [ ] Supabase base de dados criada + migrations
- [ ] Resend domínio verificado
- [ ] Stripe em live mode
- [ ] Google Analytics configurado
- [ ] SEO metadata revisada
- [ ] Imagens OG criadas (1200×630)
- [ ] Robots.txt e sitemap.xml verificados
- [ ] Performance Lighthouse > 90
- [ ] Formulários testados
- [ ] Mobile testado (iOS + Android)
