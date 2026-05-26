# GitHub Actions Secrets Required

## Deployment — Railway (API)
- `RAILWAY_TOKEN` — Railway API token (used by `railway` CLI to deploy the API service)

## Deployment — Vercel (Admin + Web)
- `VERCEL_TOKEN` — Vercel API token
- `VERCEL_ORG_ID` — Vercel organisation/team ID
- `VERCEL_ADMIN_PROJECT_ID` — Vercel project ID for the admin app
- `VERCEL_WEB_PROJECT_ID` — Vercel project ID for the web app

## Build
- `NEXT_PUBLIC_API_URL` — Public API URL exposed to Next.js builds (e.g. https://api.yourgift.pt)

## How to add secrets
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret" for each entry above
3. For `RAILWAY_TOKEN`: Railway dashboard → Account → Tokens
4. For `VERCEL_TOKEN`: Vercel → Account Settings → Tokens
5. For `VERCEL_ORG_ID` / `VERCEL_ADMIN_PROJECT_ID` / `VERCEL_WEB_PROJECT_ID`:
   run `vercel link` locally and inspect the generated `.vercel/project.json`
