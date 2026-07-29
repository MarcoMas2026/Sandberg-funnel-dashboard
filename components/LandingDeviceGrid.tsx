import { MetaBreakdownRow } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { GlowPanel } from "@/components/ui/glow-panel";

// Normalizes Meta's raw device_platform strings into the 3 buckets we display.
// Meta returns values like "mobile_app"/"mobile_web" for phones/tablets and "desktop"
// for desktop — bucketed here since the raw values aren't a fixed enum.
function bucketFor(device: string | undefined): "Mobile" | "Desktop" | "Tablet" | null {
  const d = (device ?? "").toLowerCase();
  if (d.includes("tablet")) return "Tablet";
  if (d.includes("mobile")) return "Mobile";
  if (d.includes("desktop")) return "Desktop";
  return null;
}

const ORDER: ("Mobile" | "Desktop" | "Tablet")[] = ["Mobile", "Desktop", "Tablet"];

// 3 stacked squares, one per device type — views/clicks come from Meta's own
// device breakdown; conversions (Typeform completions) aren't tracked per
// device anywhere in the pipeline today, so that field is shown as "—".
export default function LandingDeviceGrid({ byDevice }: { byDevice: MetaBreakdownRow[] }) {
  const totals: Record<string, { impressions: number; link_clicks: number }> = {
    Mobile: { impressions: 0, link_clicks: 0 },
    Desktop: { impressions: 0, link_clicks: 0 },
    Tablet: { impressions: 0, link_clicks: 0 },
  };
  for (const row of byDevice) {
    const bucket = bucketFor(row.device);
    if (!bucket) continue;
    totals[bucket].impressions += row.impressions;
    totals[bucket].link_clicks += row.link_clicks;
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-4">
      {ORDER.map((device) => (
        <GlowPanel key={device} className="panel p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">{device}</h3>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Views" value={formatNumber(totals[device].impressions)} />
            <Stat label="Clicks" value={formatNumber(totals[device].link_clicks)} />
            <Stat label="Conversions" value="—" />
          </div>
        </GlowPanel>
      ))}
      <p className="text-center text-[11px] text-[var(--text-faint)]">
        Views/clicks from Meta&apos;s device breakdown. Conversions aren&apos;t tracked per device yet.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--panel2)] p-2 text-center">
      <p className="text-sm font-semibold text-[var(--text)]">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
