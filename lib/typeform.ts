// Server-only Typeform API client, using TYPEFORM_API_TOKEN (a personal
// access token, never exposed to the browser bundle — same rule as every
// other secret in lib/). Built specifically to recover field-level drop-off
// and individual answers for campaigns that rotated out of lib/config.ts
// before db/migrations/007_campaign_detail_snapshots.sql existed — each
// still has its own distinct, still-live form_id in funnel_monthly_totals.
// Going forward this data comes from the live pipeline instead (see
// app/api/history/sync/route.ts); this module is the one-off recovery path,
// but is written generically enough to reuse for any future gap.
import { TypeformField } from "./types";

const TYPEFORM_API = "https://api.typeform.com";

function headers() {
  return { Authorization: `Bearer ${process.env.TYPEFORM_API_TOKEN}` };
}

export function isTypeformConfigured(): boolean {
  return Boolean(process.env.TYPEFORM_API_TOKEN);
}

interface InsightsField {
  id: string;
  title: string;
  views: number;
  dropoffs: number;
}

// GET /insights/{form_id}/summary — field-level views/dropoffs, same shape
// TypeformForm.fields already uses live. Order matches the form's own field
// order (Typeform returns `fields` in form order already).
export async function fetchFormFieldSummary(formId: string): Promise<TypeformField[]> {
  const res = await fetch(`${TYPEFORM_API}/insights/${formId}/summary`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Typeform insights summary failed for ${formId}: ${res.status}`);
  const json = await res.json();
  const fields: InsightsField[] = json.fields ?? [];
  return fields.map((f) => ({
    id: f.id,
    label: f.title,
    views: f.views,
    dropoffs: f.dropoffs,
    dropoff_rate: f.views > 0 ? f.dropoffs / f.views : 0,
  }));
}

export interface RecoveredLeadAnswer {
  response_id: string;
  submitted_at: string | null;
  first_name: string;
  last_name: string;
  language: string;
  budget: string;
  stage: string;
  buying_timeline: string;
}

interface TypeformFormDef {
  fields: {
    id: string;
    title: string;
    type: string;
    properties?: { fields?: { id: string; subfield_key: string }[] };
  }[];
}

// Exact same title-matching rules as n8n's "Funnel Dashboard - Typeform Sync"
// workflow's "Build Leads" code node, so recovered answers are structurally
// identical to live-captured ones, not a re-derived approximation.
function normalize(s: string | undefined | null): string {
  return String(s ?? "").trim().toLowerCase();
}

function roleForTitle(title: string): "language" | "budget" | "stage" | "buying_timeline" | null {
  const t = normalize(title);
  if (t.includes("preferred language") || t === "what is your preferred language?") return "language";
  if (t.includes("invest") || t.includes("budget")) return "budget";
  if (t.includes("stage") && (t.includes("search") || t.includes("property"))) return "stage";
  if (t.includes("intend") && t.includes("buying")) return "buying_timeline";
  return null;
}

function buildFieldMap(formDef: TypeformFormDef): Record<string, "language" | "budget" | "stage" | "buying_timeline" | "first_name" | "last_name"> {
  const map: Record<string, "language" | "budget" | "stage" | "buying_timeline" | "first_name" | "last_name"> = {};
  for (const f of formDef.fields ?? []) {
    const role = roleForTitle(f.title);
    if (role) map[f.id] = role;
    if (f.type === "contact_info") {
      for (const sub of f.properties?.fields ?? []) {
        if (sub.subfield_key === "first_name") map[sub.id] = "first_name";
        if (sub.subfield_key === "last_name") map[sub.id] = "last_name";
      }
    }
  }
  return map;
}

interface TypeformAnswer {
  type: string;
  field: { id: string };
  choice?: { label: string };
  choices?: { labels: string[] };
  text?: string;
}

interface TypeformResponseItem {
  response_id: string;
  submitted_at?: string;
  landed_at?: string;
  answers?: TypeformAnswer[];
}

// GET /forms/{form_id}/responses, paginated via Typeform's `before` cursor
// (page_size max 1000), completed responses only — matches the live
// pipeline's "Get Completed Responses" node.
export async function fetchFormResponses(formId: string): Promise<RecoveredLeadAnswer[]> {
  const formRes = await fetch(`${TYPEFORM_API}/forms/${formId}`, { headers: headers(), cache: "no-store" });
  if (!formRes.ok) throw new Error(`Typeform form definition failed for ${formId}: ${formRes.status}`);
  const formDef: TypeformFormDef = await formRes.json();
  const fieldMap = buildFieldMap(formDef);

  const answers: RecoveredLeadAnswer[] = [];
  let before: string | undefined;
  for (;;) {
    const url = new URL(`${TYPEFORM_API}/forms/${formId}/responses`);
    url.searchParams.set("page_size", "1000");
    url.searchParams.set("completed", "true");
    if (before) url.searchParams.set("before", before);
    const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`Typeform responses failed for ${formId}: ${res.status}`);
    const json = await res.json();
    const items: TypeformResponseItem[] = json.items ?? [];
    if (items.length === 0) break;

    for (const r of items) {
      const values: Record<string, string> = {};
      for (const a of r.answers ?? []) {
        const role = fieldMap[a.field?.id];
        if (!role) continue;
        if (a.type === "choice") values[role] = a.choice?.label ?? "";
        else if (a.type === "text") values[role] = a.text ?? "";
        else if (a.type === "choices") values[role] = (a.choices?.labels ?? []).join(", ");
      }
      answers.push({
        response_id: r.response_id,
        submitted_at: r.submitted_at ?? r.landed_at ?? null,
        first_name: values.first_name ?? "",
        last_name: values.last_name ?? "",
        language: values.language ?? "",
        budget: values.budget ?? "",
        stage: values.stage ?? "",
        buying_timeline: values.buying_timeline ?? "",
      });
    }

    if (items.length < 1000) break;
    before = items[items.length - 1].response_id;
  }
  return answers;
}
