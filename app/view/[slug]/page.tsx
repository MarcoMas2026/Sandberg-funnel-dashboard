import { notFound } from "next/navigation";
import { resolvePublicView } from "@/lib/kv";
import { PublicViewTile } from "@/lib/public-view-registry";
import { Logo } from "@/components/Logo";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PublicViewPage({ params }: { params: { slug: string } }) {
  const resolved = await resolvePublicView(params.slug);
  if (!resolved) notFound();

  const { propertyLabel, theme, widgets, frozen, frozenAt, data } = resolved;
  const cols = 12;
  const rowHeight = 90;
  const gap = 16;

  return (
    <div data-pv-theme={theme} className="pv-canvas min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: "var(--pv-border)" }}>
        <div className="flex items-center gap-3">
          <Logo className="h-7 w-7" />
          <div>
            <div className="text-lg font-semibold" style={{ color: "var(--pv-text)" }}>
              {propertyLabel}
            </div>
            <div className="text-xs" style={{ color: "var(--pv-muted)" }}>
              Sandberg Estates — Campaign Performance
            </div>
          </div>
        </div>
        {frozen && frozenAt && (
          <div className="text-xs" style={{ color: "var(--pv-muted)" }}>
            Report as of {formatDate(frozenAt)}
          </div>
        )}
      </header>

      <main className="px-6 py-8">
        {widgets.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--pv-muted)" }}>
            This report has no metrics yet.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridAutoRows: `${rowHeight}px`,
              gap,
            }}
          >
            {widgets.map((widget) => (
              <div
                key={widget.id}
                style={{
                  gridColumn: `${widget.layout.x + 1} / span ${widget.layout.w}`,
                  gridRow: `${widget.layout.y + 1} / span ${widget.layout.h}`,
                }}
              >
                <PublicViewTile widget={widget} data={data} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
