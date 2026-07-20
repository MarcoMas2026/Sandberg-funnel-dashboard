// Horizontal progress bar for a Key Result: filled segment for `value`, plus
// an optional tick mark at `expected` (the pace-adjusted target for today) so
// ahead/behind-pace reads at a glance rather than just showing a raw percent.
export function ProgressBar({
  value,
  expected,
  target = 1,
}: {
  value: number; // 0..1
  expected?: number; // 0..1
  target?: number; // 0..1, the KR's own target — the bar's full scale
}) {
  const scale = target > 0 ? target : 1;
  const fillPct = Math.max(0, Math.min(100, (value / scale) * 100));
  const tickPct = expected !== undefined ? Math.max(0, Math.min(100, (expected / scale) * 100)) : null;
  const behind = expected !== undefined && value < expected;
  const color = behind ? "#f87171" : "#34d399";

  return (
    <div className="relative h-2 w-full rounded-full bg-[var(--panel2)]">
      <div
        className="h-2 rounded-full transition-[width] duration-700"
        style={{ width: `${fillPct}%`, backgroundColor: color }}
      />
      {tickPct !== null && (
        <div
          className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full bg-white/70"
          style={{ left: `${tickPct}%` }}
          title="Expected pace"
        />
      )}
    </div>
  );
}
