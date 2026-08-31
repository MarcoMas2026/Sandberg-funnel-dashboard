import { LeadRecord } from "@/lib/types";
import { GlowPanel } from "@/components/ui/glow-panel";
import { DotsThree } from "@phosphor-icons/react";

const MAX_AXIS_VALUES = 4; // top N distinct raw values per axis, rest folded into "Other"
const OTHER = "Other";

// Distinct non-blank values for a field, ranked by frequency, top N + "Other" for the rest.
function topValues(leads: LeadRecord[], field: "budget" | "stage"): string[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const v = l[field];
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  const top = sorted.slice(0, MAX_AXIS_VALUES);
  return sorted.length > MAX_AXIS_VALUES ? [...top, OTHER] : top;
}

function bucketOf(value: string, top: string[]): string {
  return top.includes(value) ? value : OTHER;
}

// Segmentation matrix — leads plotted by budget (rows) x buying stage (columns), NOT a
// geographic map. Cell shading intensity = count of leads in that combo, so hot cells
// pop out as the most common budget/stage pairing among submissions.
export default function LeadSegmentationMatrix({ leads }: { leads: LeadRecord[] }) {
  const budgets = topValues(leads, "budget");
  const stages = topValues(leads, "stage");

  const grid: Record<string, Record<string, number>> = {};
  for (const b of budgets) grid[b] = Object.fromEntries(stages.map((s) => [s, 0]));

  let counted = 0;
  for (const l of leads) {
    if (!l.budget || !l.stage) continue;
    const b = bucketOf(l.budget, budgets);
    const s = bucketOf(l.stage, stages);
    grid[b][s] = (grid[b][s] ?? 0) + 1;
    counted++;
  }
  const max = Math.max(1, ...budgets.flatMap((b) => stages.map((s) => grid[b][s])));

  return (
    <GlowPanel className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Response map</h2>
        <button className="icon-btn" aria-label="Options" disabled>
          <DotsThree className="h-4 w-4" />
        </button>
      </div>

      {budgets.length === 0 || stages.length === 0 ? (
        <p className="text-xs text-[var(--text-faint)]">Not enough budget/stage answers yet to segment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="p-1 text-left font-normal text-[var(--text-faint)]">Budget \ Stage</th>
                {stages.map((s) => (
                  <th key={s} className="p-1 text-center font-normal capitalize text-[var(--text-faint)]">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b}>
                  <td className="p-1 capitalize text-[var(--text-muted)]">{b}</td>
                  {stages.map((s) => {
                    const v = grid[b][s];
                    const alpha = v > 0 ? 0.15 + 0.65 * (v / max) : 0;
                    return (
                      <td key={s} className="p-1 text-center">
                        <div
                          className="mx-auto flex h-8 w-full min-w-[36px] items-center justify-center rounded-md font-semibold text-[var(--text)]"
                          style={{ background: v > 0 ? `rgba(2, 187, 187, ${alpha})` : "var(--panel2)" }}
                        >
                          {v > 0 ? v : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-faint)]">
        {counted} of {leads.length} submissions have both a budget and stage answer, blanks excluded.
      </p>
    </GlowPanel>
  );
}
