# Sandberg Estates – Funnel Intelligence

A marketing funnel dashboard tracking Meta Ads → Landing Page → Typeform →
Qualified Lead for Sandberg Estates campaigns. Data is synced by n8n into
Vercel KV; the dashboard reads it and visualizes drop-off, cost, and
conversion at every stage.

## Stack

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Recharts
- Vercel KV
- Deployed to Vercel via GitHub Actions

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | The n8n webhook URL that the "Update" button POSTs to, which kicks off the Meta → Typeform → Merge sync chain (see `/docs/n8n-workflow.md`). |
| `KV_REST_API_URL` | From the Vercel KV dashboard (Storage → your KV store → `.env.local` tab). |
| `KV_REST_API_TOKEN` | From the same Vercel KV dashboard tab. |

For deployment, add these as both Vercel project environment variables and as
GitHub repo secrets (`Settings → Secrets and variables → Actions`), alongside:

| Secret | Description |
| --- | --- |
| `VERCEL_TOKEN` | Vercel personal access token (Account Settings → Tokens). |
| `VERCEL_ORG_ID` | From `vercel project ls` or the project's `.vercel/project.json` after `vercel link`. |
| `VERCEL_PROJECT_ID` | Same as above. |

## Adding a new campaign

1. Open `/lib/config.ts` and append a new entry to `CAMPAIGN_MAP`:
   ```ts
   {
     meta_campaign_id: "<meta campaign id>",
     meta_campaign_name: "<meta campaign name>",
     typeform_form_id: "<typeform form id>",
     typeform_form_name: "<typeform form name>",
     property: "<display name>",
     ref: "<internal property ref>",
   }
   ```
2. If your n8n Typeform-sync workflow keeps its own copy of the campaign map
   (rather than reading the repo), add the same mapping there.
3. Click **Update** on the dashboard, or wait for the next scheduled n8n run.
   The new campaign will appear once `funnel:merged` is rewritten.

See `/docs/n8n-workflow.md` for the full workflow breakdown.

## Getting a Meta long-lived access token

1. Create or use an existing Meta app at [developers.facebook.com](https://developers.facebook.com/apps).
2. Generate a short-lived User Access Token with the `ads_read` permission via
   Graph API Explorer, using a user that has access to the ad account.
3. Exchange it for a long-lived token:
   ```
   GET https://graph.facebook.com/v19.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={SHORT_LIVED_TOKEN}
   ```
4. Long-lived user tokens last ~60 days. For a token that doesn't expire,
   convert it to a System User token via Business Manager
   (Business Settings → System Users → Generate Token), assigned access to
   the ad account.
5. Store the token in n8n credentials as `META_ACCESS_TOKEN`.

## Getting a Typeform Personal Access Token

1. Log in to [Typeform](https://admin.typeform.com).
2. Go to **My Account → Personal tokens**.
3. Click **Generate a new token**, name it (e.g. "n8n sync"), and copy it —
   it's only shown once.
4. Store it in n8n credentials as `TYPEFORM_TOKEN`, used as a Bearer token in
   the `Authorization` header for all Typeform API requests.

## Project structure

```
/app
  /page.tsx                  Overview (default view)
  /campaign/[id]/page.tsx    Campaign deep dive
  /compare/page.tsx          Side-by-side comparison
  /trends/page.tsx           Trends & patterns
  /api/update/route.ts       POST: triggers n8n webhook
  /api/funnel/route.ts       GET: reads funnel:merged from Vercel KV
  /api/health/route.ts       GET: returns last_updated timestamp
/components                  FunnelColumn, MetricCard, DropoffChart, etc.
/lib                         kv.ts, types.ts, config.ts, mockData.ts
/docs/n8n-workflow.md        Full n8n workflow spec
```
