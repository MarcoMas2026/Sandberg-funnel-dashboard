import { addDays, daysBetween } from "@/lib/okr-pace";
import { formatDate, todayISOMadrid } from "@/lib/format";
import { KanbanTask, OkrDepartment } from "@/lib/types";
import { PRIORITY_COLOR, Pill } from "./viz";

// Hand-rolled, no chart library — one row per task, positioned on a shared
// date axis spanning today through the furthest OKR cycle end date. Each
// row also shows a faint band for that task's own department's cycle range,
// so a shorter-cycle department's tasks visually read as "boxed in" rather
// than mispositioned against the shared axis.
export default function TaskTimeline({ tasks, departments }: { tasks: KanbanTask[]; departments: OkrDepartment[] }) {
  const today = todayISOMadrid();
  const starts = departments.map((d) => d.startDate).filter((d): d is string => Boolean(d));
  const ends = departments.map((d) => d.endDate).filter((d): d is string => Boolean(d));

  const axisStart = starts.length ? [today, ...starts].sort()[0] : today;
  const axisEnd = ends.length ? ends.sort().slice(-1)[0] : addDays(today, 14);
  const totalDays = Math.max(1, daysBetween(axisStart, axisEnd));

  const pct = (dateISO: string) => Math.max(0, Math.min(100, (daysBetween(axisStart, dateISO) / totalDays) * 100));
  const todayPct = pct(today);

  const deptByTab = new Map(departments.map((d) => [d.tab, d]));
  const sorted = [...tasks].sort((a, b) => a.department.localeCompare(b.department) || a.krLabel.localeCompare(b.krLabel));

  return (
    <div className="panel mt-5 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill label="High" active={false} dot={PRIORITY_COLOR.high} />
        <Pill label="Medium" active={false} dot={PRIORITY_COLOR.medium} />
        <Pill label="Low" active={false} dot={PRIORITY_COLOR.low} />
        <span className="ml-auto text-xs text-[var(--text-faint)]">
          {formatDate(axisStart)} – {formatDate(axisEnd)}
        </span>
      </div>

      {sorted.length === 0 && <p className="text-sm text-[var(--text-faint)]">No tasks yet — generate today's board.</p>}

      <div className="relative">
        {/* today marker, spans the full row stack */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-white/50"
          style={{ left: `${todayPct}%` }}
        >
          <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--text-faint)]">
            Today
          </span>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          {sorted.map((task) => {
            const dept = deptByTab.get(task.department);
            const bandStart = dept?.startDate ? pct(dept.startDate) : null;
            const bandEnd = dept?.endDate ? pct(dept.endDate) : null;
            const dotPct = pct(task.dueDate);
            const color = PRIORITY_COLOR[task.priority];
            const isDone = task.status === "done";

            return (
              <div key={task.id} className="flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-xs text-[var(--text-muted)]" title={task.krLabel}>
                  {task.krLabel}
                </div>
                <div className="relative h-6 flex-1 rounded bg-[var(--panel2)]">
                  {bandStart !== null && bandEnd !== null && (
                    <div
                      className="absolute top-0 h-full rounded bg-white/5"
                      style={{ left: `${bandStart}%`, width: `${Math.max(0, bandEnd - bandStart)}%` }}
                    />
                  )}
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${dotPct}%`,
                      backgroundColor: color,
                      opacity: isDone ? 0.5 : 1,
                    }}
                    title={`Due ${formatDate(task.dueDate)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
