# n8n Workflows

Three workflows feed Vercel KV, which the dashboard reads from. All three should
run in sequence (Meta sync → Typeform sync → Merge), triggered by the same
webhook so a single "Update" click refreshes everything.

## Workflow 1 — Meta Ads sync

- **Trigger:** Webhook (POST)
- **HTTP Request node:**
  `GET https://graph.facebook.com/v19.0/act_908802846497778/campaigns`
  - `fields=id,name,status,insights{spend,impressions,clicks,cpm,ctr,cpc}`
  - `date_preset=last_30d`
  - `access_token={{META_ACCESS_TOKEN}}`
- **Function node (Transform):** extract and normalize each campaign into the
  `MetaCampaign` shape (`id`, `name`, `status`, `spend`, `impressions`,
  `clicks`, `link_clicks`, `cpm`, `ctr`, `cpl`). `link_clicks` should be pulled
  from the `actions` array (`action_type: link_click`) if not present at the
  top level; `cpl` = `spend / link_clicks` as a fallback if Meta doesn't return
  it directly.
- **Write to Vercel KV:** key `meta:campaigns`, value = JSON array of
  `MetaCampaign`.

## Workflow 2 — Typeform sync

- **HTTP Request node:**
  `GET https://api.typeform.com/forms`
  - header: `Authorization: Bearer {{TYPEFORM_TOKEN}}`
- **Loop (SplitInBatches) over `CAMPAIGN_MAP`:** for each entry, call:
  - `GET https://api.typeform.com/forms/{form_id}/insights/summary`
  - `GET https://api.typeform.com/forms/{form_id}/insights/fields`
- **Function node (Transform):** normalize into the `TypeformForm` shape,
  including the per-field `views`, `dropoffs`, and `dropoff_rate` for the
  `fields` array.
- **Write to Vercel KV:** key `typeform:forms`, value = JSON array of
  `TypeformForm`.

## Workflow 3 — Merge & finalize

- **Trigger:** runs after workflows 1 and 2 complete (chain via "Execute
  Workflow" nodes, or sub-workflow calls from the same webhook trigger).
- Reads `meta:campaigns` and `typeform:forms` from Vercel KV.
- **Joins** each Meta campaign to its Typeform form using `CAMPAIGN_MAP`
  (`meta_campaign_id` ↔ `typeform_form_id`) from `/lib/config.ts`.
- **Calculates derived metrics** per campaign:
  - `click_to_form_start_rate = typeform.starts / meta.link_clicks`
  - `form_completion_rate = typeform.completions / typeform.starts`
  - `cost_per_qualified_lead = meta.spend / typeform.completions`
- **Writes to Vercel KV:**
  - key `funnel:merged`, value = `FunnelData` object (`campaigns`,
    `last_updated`, `status: "fresh"`)
  - key `funnel:last_updated`, value = ISO timestamp

## Adding a new campaign

1. Add a new entry to `CAMPAIGN_MAP` in `/lib/config.ts` with the Meta
   campaign ID/name and the Typeform form ID/name.
2. No n8n change is required for Workflow 1 (it pulls all campaigns from the
   ad account) or Workflow 2 (it loops over `CAMPAIGN_MAP`, so just keep the
   n8n copy of the map in sync if it's duplicated there instead of fetched
   from the repo).
3. Trigger an Update from the dashboard (or wait for the next scheduled run)
   to populate `funnel:merged` with the new campaign.
